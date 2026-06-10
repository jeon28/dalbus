import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { requireAdmin } from '@/lib/auth';

export async function GET(req: NextRequest) {
    const denied = await requireAdmin(req);
    if (denied) return denied;
    try {
        const { data, error } = await supabaseAdmin
            .from('email_templates')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        return NextResponse.json(data);
    } catch (error) {
        console.error('Error fetching email templates:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    const denied = await requireAdmin(request);
    if (denied) return denied;
    try {
        const body = await request.json();
        const { key, name, subject, content, placeholders, design } = body;

        if (!key || !name || !subject || !content) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const { data, error } = await supabaseAdmin
            .from('email_templates')
            .insert([{ key, name, subject, content, placeholders, design }])
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json(data);
    } catch (error) {
        console.error('Error creating email template:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
