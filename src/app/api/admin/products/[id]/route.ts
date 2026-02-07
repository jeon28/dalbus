import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const { data, error } = await supabaseAdmin
        .from('products')
        .select(`
            *,
            product_plans (*)
        `)
        .eq('id', id)
        .single();

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    try {
        const body = await req.json();
        // Exclude plans from product update, they are handled separately or via different logic if needed
        // But here we might receive them. For now, let's just update product fields.
        const { slug, name, original_price, description, benefits, image_url, sort_order, is_active } = body;

        const { data, error } = await supabaseAdmin
            .from('products')
            .update({
                slug,
                name,
                original_price,
                description,
                benefits,
                image_url,
                sort_order,
                is_active
            })
            .eq('id', id)
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

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const { error } = await supabaseAdmin
        .from('products')
        .delete()
        .eq('id', id);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}
