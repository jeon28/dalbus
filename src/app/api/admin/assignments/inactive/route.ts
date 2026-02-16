import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const { data, error } = await supabaseAdmin
            .from('order_accounts')
            .select(`
                *,
                accounts ( login_id ),
                orders ( 
                    order_number, 
                    buyer_name,
                    buyer_email,
                    buyer_phone,
                    profiles ( name, phone )
                )
            `)
            .eq('is_active', false)
            .order('assigned_at', { ascending: false });

        if (error) throw error;

        return NextResponse.json(data);
    } catch (error) {
        const e = error as Error;
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
