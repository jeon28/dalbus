import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { syncUsedSlots } from '@/lib/assignment-utils';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: Promise<{ accountId: string }> }) {
    try {
        const { accountId: account_id } = await params;
        const body = await req.json();
        const {
            slot_number,
            tidal_password,
            tidal_id,
            type,
            buyer_name,
            buyer_phone,
            buyer_email,
            start_date,
            end_date,
            amount,
            period_months,
            memo,
            order_number
        } = body;

        // Fetch current assignments to determine next slot
        const { data: currentAssignments, error: fetchError } = await supabaseAdmin
            .from('legacy_tidal_assignments')
            .select('id, slot_number, type')
            .eq('account_id', account_id)
            .eq('is_active', true)
            .eq('is_deleted', false)
            .order('slot_number', { ascending: true });

        if (fetchError) throw fetchError;

        let finalSlotNumber = slot_number;
        let finalType = type;

        if (finalSlotNumber === undefined || finalSlotNumber === null) {
            // 불연속 슬롯 상태에서도 가장 작은 빈 번호를 탐색
            const usedSlots = new Set(currentAssignments?.map(a => a.slot_number) ?? []);
            let candidate = 0;
            while (usedSlots.has(candidate)) candidate++;
            finalSlotNumber = candidate;
        }

        if (!finalType) {
            finalType = finalSlotNumber === 0 ? 'master' : 'user';
        }

        // Check for existing at this slot
        const existingAssignment = currentAssignments?.find(a => a.slot_number === finalSlotNumber);

        if (existingAssignment) {
            const { error: updateError } = await supabaseAdmin
                .from('legacy_tidal_assignments')
                .update({
                    order_number: order_number || null,
                    tidal_password: tidal_password || null,
                    tidal_id: tidal_id ? tidal_id.toLowerCase().trim() : null,
                    type: finalType,
                    buyer_name: buyer_name || null,
                    buyer_phone: buyer_phone || null,
                    buyer_email: buyer_email || null,
                    start_date: start_date || null,
                    end_date: end_date || null,
                    amount: amount !== undefined ? amount : null,
                    period_months: period_months !== undefined ? period_months : null,
                    memo: memo || null,
                    is_active: true,
                    is_deleted: false
                })
                .eq('id', existingAssignment.id);

            if (updateError) throw updateError;
        } else {
            const { error: insertError } = await supabaseAdmin
                .from('legacy_tidal_assignments')
                .insert([{
                    account_id,
                    slot_number: finalSlotNumber,
                    tidal_password: tidal_password || null,
                    tidal_id: tidal_id ? tidal_id.toLowerCase().trim() : null,
                    type: finalType,
                    buyer_name: buyer_name || null,
                    buyer_phone: buyer_phone || null,
                    buyer_email: buyer_email || null,
                    order_number: order_number || null,
                    start_date: start_date || null,
                    end_date: end_date || null,
                    amount: amount !== undefined ? amount : null,
                    period_months: period_months !== undefined ? period_months : null,
                    memo: memo || null,
                    is_active: true,
                    is_deleted: false
                }]);

            if (insertError) throw insertError;
        }

        // Sync used_slots
        await syncUsedSlots(account_id, 'legacy_tidal_accounts', 'legacy_tidal_assignments');

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Legacy Tidal Assign Error:', error);
        const err = error as { code?: string; message: string };
        if (err.code === '23505') {
            return NextResponse.json({ error: '이미 사용 중인 Tidal ID입니다.' }, { status: 409 });
        }
        return NextResponse.json({ error: err.message || '알 수 없는 오류가 발생했습니다.' }, { status: 500 });
    }
}
