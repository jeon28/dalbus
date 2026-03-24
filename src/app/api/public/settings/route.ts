import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin';
import { NextResponse } from 'next/server';

export async function GET() {
    try {

        // Fetch only non-sensitive public settings
        const { data: settings, error } = await supabase
            .from('site_settings')
            .select('key, value')
            .in('key', ['menu_faq_enabled', 'menu_qna_enabled']);

        if (error) throw error;

        // Convert array to object for easier consumption
        const publicSettings = settings?.reduce((acc: Record<string, string>, curr: { key: string; value: string }) => {
            acc[curr.key] = curr.value;
            return acc;
        }, {}) || {};

        return NextResponse.json(publicSettings);
    } catch (error) {
        console.error('Public Settings Fetch Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
