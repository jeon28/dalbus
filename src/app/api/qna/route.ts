import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const excludeSecret = searchParams.get('exclude_secret') === 'true';
    const userId = searchParams.get('user_id'); // Optional: fetch my posts

    let query = supabaseAdmin
        .from('qna')
        .select('*')
        .order('created_at', { ascending: false });

    if (excludeSecret) {
        query = query.eq('is_secret', false);
    }

    if (userId) {
        query = query.eq('user_id', userId);
    }

    const { data, error } = await query;

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        // body should contain: title, content, is_secret, user_id (opt), guest_name (opt), guest_password (opt)

        const { data, error } = await supabaseAdmin
            .from('qna')
            .insert(body)
            .select()
            .single();

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json(data);
    } catch (e) {
        return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }
}
