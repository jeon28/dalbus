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
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return null;
        }

        const token = authHeader.split(' ')[1];

        // 1. Verify token with Supabase Auth
        const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
        if (authError || !user) {
            return null;
        }

        // 2. Fetch role from profiles table
        const { data: profile, error: profileError } = await supabaseAdmin
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();

        if (profileError || !profile) {
            // If profile is missing but user is authenticated, default to 'user'
            // or return null if we want to be strict.
            return {
                id: user.id,
                email: user.email,
                role: 'user'
            };
        }

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
