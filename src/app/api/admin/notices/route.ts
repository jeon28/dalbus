import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function GET() {
    const { data, error } = await supabaseAdmin
        .from('notices')
        .select('*')
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { title, content, category, is_published, is_pinned } = body;

        const { data, error } = await supabaseAdmin
            .from('notices')
            .insert({
                title,
                content,
                category,
                is_published: is_published !== undefined ? is_published : true,
                is_pinned: is_pinned || false
            })
            .select()
            .single();

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json(data);
    } catch {
        return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }
}
