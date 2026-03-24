import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getServerSession, isAdmin } from '@/lib/auth';
import { sendEmail } from '@/lib/email';

export const dynamic = 'force-dynamic';

// GET: Fetch mail history
export async function GET(req: NextRequest) {
    try {
        const session = await getServerSession(req);
        if (!isAdmin(session)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        const { searchParams } = new URL(req.url);
        const recipient = searchParams.get('recipient');
        const type = searchParams.get('type');
        const status = searchParams.get('status');
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '50');
        const sort = searchParams.get('sort') || 'sent_at';
        const order = searchParams.get('order') || 'desc';

        let query = supabaseAdmin
            .from('mail_history')
            .select('*', { count: 'exact' });

        if (recipient) {
            query = query.or(`recipient_email.ilike.%${recipient}%,recipient_name.ilike.%${recipient}%`);
        }
        if (type) {
            query = query.eq('mail_type', type);
        }
        if (status) {
            query = query.eq('status', status);
        }

        // Validate sort column to prevent injection or errors
        const allowedSortCols = ['sent_at', 'mail_type', 'recipient_email', 'status', 'subject'];
        const finalSort = allowedSortCols.includes(sort) ? sort : 'sent_at';

        const { data, error, count } = await query
            .order(finalSort, { ascending: order === 'asc' })
            .range((page - 1) * limit, page * limit - 1);

        // Handle PGRST103: Range Not Satisfiable (happens when table is empty and range is requested)
        if (error) {
            if (error.code === 'PGRST103') {
                return NextResponse.json({
                    data: [],
                    pagination: {
                        total: 0,
                        page,
                        limit,
                        totalPages: 0
                    }
                });
            }
            console.error('Mail history fetch error:', error);
            throw error;
        }

        return NextResponse.json({
            data,
            pagination: {
                total: count,
                page,
                limit,
                totalPages: Math.ceil((count || 0) / limit)
            }
        });
    } catch (error) {
        const e = error as Error;
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

// POST: Resend mail
export async function POST(req: NextRequest) {
    try {
        const session = await getServerSession(req);
        if (!isAdmin(session)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        const body = await req.json();
        const { id } = body;

        if (!id) {
            return NextResponse.json({ error: 'Mail history ID is required' }, { status: 400 });
        }

        // Fetch original mail details
        const { data: originalMail, error: fetchError } = await supabaseAdmin
            .from('mail_history')
            .select('*')
            .eq('id', id)
            .single();

        if (fetchError || !originalMail) {
            return NextResponse.json({ error: 'Original mail record not found' }, { status: 404 });
        }

        // Resend using generic sendEmail function
        const result = await sendEmail({
            recipient_email: originalMail.recipient_email,
            recipient_name: originalMail.recipient_name,
            subject: originalMail.subject, // Or maybe prefix with [Resend]? The plan didn't specify.
            html: originalMail.content,
            mailType: originalMail.mail_type
        });

        if (!result.success) {
            return NextResponse.json({ error: result.error || 'Failed to resend email' }, { status: 500 });
        }

        return NextResponse.json({ success: true, data: result.data });
    } catch (error) {
        const e = error as Error;
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
