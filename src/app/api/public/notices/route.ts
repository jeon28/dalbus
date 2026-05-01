import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const { data, error } = await supabaseAdmin
            .from('notices')
            .select('*')
            .eq('is_published', true)
            .order('is_pinned', { ascending: false })
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching public notices:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json(data || []);
    } catch (error) {
        console.error('Unexpected error in notices api:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
