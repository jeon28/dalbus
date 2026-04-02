import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { normalizePhone } from '@/lib/utils';

export async function POST(request: NextRequest) {
    try {
        const { phone, currentEmail } = await request.json();

        if (!phone) {
            return NextResponse.json({ different: false });
        }

        const normalizedPhone = normalizePhone(phone);
        const normalizedCurrentEmail = currentEmail.toLowerCase();

        // 1. Find the most recent guest order with this phone number
        const { data: orders, error } = await supabaseAdmin
            .from('orders')
            .select('buyer_email')
            .eq('buyer_phone', normalizedPhone)
            .eq('is_guest', true)
            .order('created_at', { ascending: false })
            .limit(1);

        if (error || !orders || orders.length === 0) {
            return NextResponse.json({ different: false });
        }

        const prevEmail = orders[0].buyer_email?.toLowerCase();
        
        if (prevEmail && prevEmail !== normalizedCurrentEmail) {
            return NextResponse.json({ 
                different: true, 
                prevEmail 
            });
        }

        return NextResponse.json({ different: false });

    } catch (error) {
        console.error('Check guest email error:', error);
        return NextResponse.json({ different: false });
    }
}
