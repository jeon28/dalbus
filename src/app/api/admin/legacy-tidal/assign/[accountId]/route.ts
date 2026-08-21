import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { findFirstEmptySlot, syncUsedSlots } from '@/lib/assignment-utils';

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

        // 삭제/비활성 행까지 모두 가져온다.
        // - 비활성 행도 자기 슬롯 번호를 계속 점유한다 (화면에 그 번호로 남아 있음)
        // - 삭제 행은 (account_id, slot_number) 유니크 제약 때문에 insert가 아니라 되살려야 한다
        const { data: currentAssignments, error: fetchError } = await supabaseAdmin
            .from('legacy_tidal_assignments')
            .select('id, slot_number, type, is_active, is_deleted')
            .eq('account_id', account_id)
            .order('slot_number', { ascending: true });

        if (fetchError) throw fetchError;

        let finalSlotNumber = slot_number;
        let finalType = type;

        if (finalSlotNumber === undefined || finalSlotNumber === null) {
            // 슬롯 번호는 고정이므로 중간이 비어 있을 수 있다. 비어 있는 가장 작은 번호를 채운다.
            finalSlotNumber = findFirstEmptySlot(currentAssignments);
        }

        if (!finalType) {
            finalType = finalSlotNumber === 0 ? 'master' : 'user';
        }

        // Check for existing at this slot (삭제된 행 포함)
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
            // 정원 초과 방지: 신규 배정은 정원(max_slots) 안에서만 생성한다.
            // (초과를 허용하면 slot_number가 정원 밖으로 밀려 화면에서 누락된다)
            const { data: account, error: accountError } = await supabaseAdmin
                .from('legacy_tidal_accounts')
                .select('max_slots')
                .eq('id', account_id)
                .single();

            if (accountError) throw accountError;

            const activeCount = currentAssignments?.filter(a => a.is_deleted !== true && a.is_active !== false).length ?? 0;
            if (activeCount >= account.max_slots) {
                return NextResponse.json(
                    { error: `슬롯 부족 (${activeCount}/${account.max_slots}) — 정원을 늘리거나 기존 배정을 정리해주세요.` },
                    { status: 400 }
                );
            }
            if (finalSlotNumber >= account.max_slots) {
                return NextResponse.json(
                    { error: `정원(${account.max_slots}개)을 벗어난 슬롯 번호입니다.` },
                    { status: 400 }
                );
            }

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
