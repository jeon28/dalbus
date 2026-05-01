import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const { data, error } = await supabaseAdmin
            .from('faqs')
            .select('*')
            .eq('is_published', true)
            .order('sort_order', { ascending: true });

        if (error) {
            console.error('Error fetching public FAQs:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json(data || []);
    } catch (error) {
        console.error('Unexpected error in faqs api:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
