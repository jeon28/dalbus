import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const { data, error } = await supabaseAdmin
            .from('faq_categories')
            .select('*')
            .order('sort_order', { ascending: true });

        if (error) {
            console.error('Error fetching public FAQ categories:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json(data || []);
    } catch (error) {
        console.error('Unexpected error in faq-categories api:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
