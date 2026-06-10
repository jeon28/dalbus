import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { requireAdmin } from '@/lib/auth';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const denied = await requireAdmin(request);
    if (denied) return denied;
    try {
        const { id } = await params;
        const { data, error } = await supabaseAdmin
            .from('email_templates')
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw error;
        if (!data) return NextResponse.json({ error: 'Not Found' }, { status: 404 });

        return NextResponse.json(data);
    } catch (error) {
        console.error('Error fetching email template:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const denied = await requireAdmin(request);
    if (denied) return denied;
    try {
        const { id } = await params;
        const body = await request.json();
        const { key, name, subject, content, placeholders, design } = body;

        const { data, error } = await supabaseAdmin
            .from('email_templates')
            .update({ key, name, subject, content, placeholders, design })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json(data);
    } catch (error) {
        console.error('Error updating email template:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const denied = await requireAdmin(request);
    if (denied) return denied;
    try {
        const { id } = await params;
        const { error } = await supabaseAdmin
            .from('email_templates')
            .delete()
            .eq('id', id);

        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting email template:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
