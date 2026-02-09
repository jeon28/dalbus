import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function GET() {
    const { data, error } = await supabaseAdmin
        .from('faqs')
        .select('*')
        .order('sort_order', { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { question, answer, category, sort_order, is_published } = body;

        const { data, error } = await supabaseAdmin
            .from('faqs')
            .insert({
                question,
                answer,
                category,
                sort_order: sort_order || 0,
                is_published: is_published !== undefined ? is_published : true
            })
            .select()
            .single();

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json(data);
    } catch {
        return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }
}
