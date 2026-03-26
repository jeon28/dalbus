import { NextRequest } from 'next/server';
import { supabaseAdmin } from './supabaseAdmin';

export interface ServerSessionUser {
    id: string;
    email?: string;
    role: 'user' | 'admin';
}

/**
 * Verifies the session from the Authorization header and returns the user with their role.
 */
export async function getServerSession(req: NextRequest): Promise<ServerSessionUser | null> {
    try {
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
            console.log('[getServerSession] No Authorization header');
            return null;
        }
        if (!authHeader.startsWith('Bearer ')) {
            console.log('[getServerSession] Authorization header does not start with Bearer');
            return null;
        }

        const token = authHeader.split(' ')[1];
        if (!token) {
            console.log('[getServerSession] Token is empty');
            return null;
        }

        // 1. Verify token with Supabase Auth
        const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
        if (authError || !user) {
            console.error('[getServerSession] authError or no user:', authError?.message || 'No user', 'Token prefix:', token.substring(0, 10));
            return null;
        }

        // 2. Fetch role from profiles table
        const { data: profile, error: profileError } = await supabaseAdmin
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();

        if (profileError || !profile) {
            console.log('[getServerSession] Profile error or no profile for ID:', user.id, profileError?.message || 'No profile');
            // If profile is missing but user is authenticated, default to 'user'
            // or return null if we want to be strict.
            return {
                id: user.id,
                email: user.email,
                role: 'user'
            };
        }

        console.log('[getServerSession] Authenticated as:', user.email, 'Role:', profile.role);
        return {
            id: user.id,
            email: user.email,
            role: profile.role as 'user' | 'admin'
        };
    } catch (error) {
        console.error('getServerSession error:', error);
        return null;
    }
}

/**
 * Simple helper to check if a session user is an admin.
 */
export function isAdmin(session: ServerSessionUser | null): boolean {
    return session?.role === 'admin';
}
