import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function GET() {
    // In production, valid session check is required.
    // Fetching profiles with role 'user'
    const { data, error } = await supabaseAdmin
        .from('profiles')
        .select('id, name, email, phone, created_at')
        .eq('role', 'user')
        .order('created_at', { ascending: false });

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
}
