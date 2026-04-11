import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET(
    request: Request,
    { params }: { params: { id: string } }
) {
    try {
        const { data, error } = await supabaseAdmin
            .from('email_templates')
            .select('*')
            .eq('id', params.id)
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
    request: Request,
    { params }: { params: { id: string } }
) {
    try {
        const body = await request.json();
        const { key, name, subject, content, placeholders } = body;

        const { data, error } = await supabaseAdmin
            .from('email_templates')
            .update({ key, name, subject, content, placeholders })
            .eq('id', params.id)
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
    request: Request,
    { params }: { params: { id: string } }
) {
    try {
        const { error } = await supabaseAdmin
            .from('email_templates')
            .delete()
            .eq('id', params.id);

        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting email template:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
