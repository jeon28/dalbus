import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from './supabaseAdmin';

export interface ServerSessionUser {
    id: string;
    email?: string;
    role: 'user' | 'admin';
}

/**
 * 관리자 대시보드(설정)에서 관리하는 로그인 비밀번호(site_settings.admin_login_pw)를 읽는다.
 * 미설정/오류 시 null. ADMIN_QUICK_PASSWORD(env)와 함께 관리자 게이트 인증에 사용된다.
 */
export async function getAdminLoginPassword(): Promise<string | null> {
    try {
        const { data } = await supabaseAdmin
            .from('site_settings')
            .select('value')
            .eq('key', 'admin_login_pw')
            .maybeSingle();
        const v = (data?.value as string | undefined)?.trim();
        return v || null;
    } catch {
        return null;
    }
}

/**
 * Verifies the session from the Authorization header and returns the user with their role.
 */
export async function getServerSession(req: NextRequest): Promise<ServerSessionUser | null> {
    try {
        // Quick Access: X-Quick-Token 헤더로 비밀번호 인증 (Supabase 로그인 없이 접근)
        // env(ADMIN_QUICK_PASSWORD) 또는 대시보드 설정(admin_login_pw) 비밀번호 둘 다 허용
        const quickToken = req.headers.get('X-Quick-Token');
        if (quickToken) {
            const quickPassword = process.env.ADMIN_QUICK_PASSWORD;
            const matched = (quickPassword && quickToken === quickPassword)
                || (quickToken === await getAdminLoginPassword());
            if (matched) {
                console.log('[getServerSession] Quick access authenticated');
                return {
                    id: 'quick-access-admin',
                    email: 'quick@admin.local',
                    role: 'admin'
                };
            }
        }

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

/**
 * 관리자 권한 가드. 라우트 핸들러 첫 줄에서 호출한다.
 *   const denied = await requireAdmin(req);
 *   if (denied) return denied;
 * 권한이 있으면 null, 없으면 403 NextResponse 를 반환한다.
 * (X-Quick-Token 또는 admin role Supabase 세션 모두 허용 — getServerSession 참고)
 */
export async function requireAdmin(req: NextRequest): Promise<NextResponse | null> {
    const session = await getServerSession(req);
    if (!session || !isAdmin(session)) {
        return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });
    }
    return null;
}
