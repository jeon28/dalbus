import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function GET() {
    const { data, error } = await supabaseAdmin
        .from('site_settings')
        .select('*')
        .eq('id', 'main')
        .single();

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
}

export async function PUT(req: NextRequest) {
    try {
        const body = await req.json();
        const { admin_login_id, admin_login_pw } = body;

        const { data, error } = await supabaseAdmin
            .from('site_settings')
            .update({
                admin_login_id,
                admin_login_pw,
                updated_at: new Date().toISOString()
            })
            .eq('id', 'main')
            .select()
            .single();

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json(data);
    } catch {
        return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }
}
