import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: 'dalbus-auth-token',
        // Next.js 15 / Strict Mode AbortError 방지를 위해 내부 Lock 메커니즘을 No-op 함수로 대체
        lock: async <R>(name: string, timeout: number, callback: () => Promise<R>): Promise<R> => {
            return callback();
        }
    }
});
