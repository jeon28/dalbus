import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { normalizePhone } from '@/lib/utils';

export const dynamic = 'force-dynamic';

// PUT: Update legacy_tidal_account entry
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const body = await req.json();

        const {
            tidal_password,
            buyer_name,
            buyer_phone,
            buyer_email,
            start_date,
            end_date,
            type,
            is_active,
            tidal_id,
            amount,
            period_months,
            memo
        } = body;

        const updates: Record<string, string | number | boolean | null> = {};
        if (tidal_password !== undefined) updates.tidal_password = tidal_password;
        if (tidal_id !== undefined) updates.tidal_id = tidal_id ? tidal_id.toLowerCase().trim() : null;
        if (body.order_number !== undefined) updates.order_number = body.order_number;
        if (type !== undefined) updates.type = type;
        if (buyer_name !== undefined) updates.buyer_name = buyer_name;
        if (buyer_phone !== undefined) updates.buyer_phone = normalizePhone(buyer_phone);
        if (buyer_email !== undefined) updates.buyer_email = buyer_email;
        if (start_date !== undefined) updates.start_date = start_date;
        if (end_date !== undefined) updates.end_date = end_date;
        if (is_active !== undefined) updates.is_active = is_active;
        if (body.is_deleted !== undefined) updates.is_deleted = body.is_deleted;
        if (amount !== undefined) updates.amount = amount;
        if (period_months !== undefined) updates.period_months = period_months;
        if (memo !== undefined) updates.memo = memo;

        if (Object.keys(updates).length > 0) {
            const { data: updatedData, error: updateError } = await supabaseAdmin
                .from('legacy_tidal_account')
                .update(updates)
                .eq('id', id)
                .select('account_id')
                .single();

            if (updateError) throw updateError;

            // Re-index slots if type or is_active changed
            const shouldReindex = type !== undefined || is_active !== undefined;
            if (shouldReindex && updatedData) {
                const { data: allSlots, error: fetchAllError } = await supabaseAdmin
                    .from('legacy_tidal_account')
                    .select('id, slot_number, type')
                    .eq('account_id', updatedData.account_id)
                    .order('slot_number', { ascending: true });

                if (fetchAllError) throw fetchAllError;

                if (allSlots && allSlots.length > 0) {
                    const sorted = [...allSlots].sort((a, b) => {
                        if (a.type === 'master' && b.type !== 'master') return -1;
                        if (b.type === 'master' && a.type !== 'master') return 1;
                        if (a.type === 'master' && b.type === 'master') {
                            if (a.id === id) return -1;
                            if (b.id === id) return 1;
                        }
                        return a.slot_number - b.slot_number;
                    });

                    // Pass 1: Move to temporary high slots
                    for (let i = 0; i < sorted.length; i++) {
                        await supabaseAdmin
                            .from('legacy_tidal_account')
                            .update({ slot_number: sorted[i].slot_number + 1000 })
                            .eq('id', sorted[i].id);
                    }

                    // Pass 2: Assign final sequential slot numbers
                    for (let i = 0; i < sorted.length; i++) {
                        const slotUpdates: { slot_number: number; type?: string } = { slot_number: i };
                        if (i > 0 && sorted[i].type === 'master') {
                            slotUpdates.type = 'user';
                        }
                        await supabaseAdmin
                            .from('legacy_tidal_account')
                            .update(slotUpdates)
                            .eq('id', sorted[i].id);
                    }
                }

                // Sync used_slots
                const { count: actualCount } = await supabaseAdmin
                    .from('legacy_tidal_account')
                    .select('*', { count: 'exact', head: true })
                    .eq('account_id', updatedData.account_id)
                    .eq('is_deleted', false);

                await supabaseAdmin
                    .from('accounts')
                    .update({ used_slots: actualCount || 0 })
                    .eq('id', updatedData.account_id);
            }
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        const e = error as { code?: string; message: string };
        if (e.code === '23505') {
            return NextResponse.json({ error: '이미 사용 중인 Tidal ID입니다. (활성 계정 중복)' }, { status: 409 });
        }
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

// DELETE: Soft-delete legacy_tidal_account entry
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;

        // 1. Get info before delete
        const { data: assignment, error: fetchError } = await supabaseAdmin
            .from('legacy_tidal_account')
            .select('account_id')
            .eq('id', id)
            .single();

        if (fetchError || !assignment) throw new Error('Assignment not found');

        // 2. Soft delete
        const { error: delError } = await supabaseAdmin
            .from('legacy_tidal_account')
            .update({ is_deleted: true, is_active: false })
            .eq('id', id);

        if (delError) throw delError;

        // 3. Re-index remaining slots
        const { data: remainingSlots, error: fetchRemainingError } = await supabaseAdmin
            .from('legacy_tidal_account')
            .select('id, slot_number, type')
            .eq('account_id', assignment.account_id)
            .eq('is_deleted', false)
            .order('slot_number', { ascending: true });

        if (fetchRemainingError) throw fetchRemainingError;

        if (remainingSlots && remainingSlots.length > 0) {
            const sorted = [...remainingSlots].sort((a, b) => {
                if (a.type === 'master') return -1;
                if (b.type === 'master') return 1;
                return (a.slot_number ?? 0) - (b.slot_number ?? 0);
            });

            // Pass 1: Temporary high slots
            for (let i = 0; i < sorted.length; i++) {
                await supabaseAdmin
                    .from('legacy_tidal_account')
                    .update({ slot_number: (sorted[i].slot_number ?? 0) + 1000 })
                    .eq('id', sorted[i].id);
            }

            // Pass 2: Final sequential slots
            for (let i = 0; i < sorted.length; i++) {
                const slotUpdates: { slot_number: number; type?: string } = { slot_number: i };
                if (i > 0 && sorted[i].type === 'master') {
                    slotUpdates.type = 'user';
                }
                await supabaseAdmin
                    .from('legacy_tidal_account')
                    .update(slotUpdates)
                    .eq('id', sorted[i].id);
            }
        }

        // 4. Sync used_slots
        const { count: actualCount } = await supabaseAdmin
            .from('legacy_tidal_account')
            .select('*', { count: 'exact', head: true })
            .eq('account_id', assignment.account_id)
            .eq('is_active', true);

        await supabaseAdmin
            .from('accounts')
            .update({ used_slots: actualCount || 0 })
            .eq('id', assignment.account_id);

        return NextResponse.json({ success: true });
    } catch (error) {
        const e = error as Error;
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
