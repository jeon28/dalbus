import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(req: NextRequest) {
    try {
        const { accounts: importData } = await req.json();

        if (!importData || !Array.isArray(importData)) {
            return NextResponse.json({ error: 'Invalid data format' }, { status: 400 });
        }

        const results = {
            success: { masters: 0, slots: 0 },
            failed: [] as { id: string; reason: string }[],
        };

        // Group data by Master ID (login_id)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const masterMap = new Map<string, any>();
        importData.forEach((row) => {
            const masterId = row['마스터 ID'];
            if (masterId) {
                if (!masterMap.has(masterId)) {
                    masterMap.set(masterId, {
                        login_id: masterId,
                        payment_email: row['결제 계정'],
                        payment_day: parseInt(row['결제일']?.toString().replace('일', '') || '1'),
                        login_pw: '', // Default to empty string to satisfy NOT NULL constraint
                        memo: row['메모'],
                        slots: []
                    });
                }
            } else if (masterMap.size > 0) {
                // It's a slot row for the last seen master
                const lastMaster = Array.from(masterMap.values()).pop();
                if (lastMaster && row['Slot']) {
                    const slotNumber = parseInt(row['Slot'].replace('Slot ', '')) - 1;

                    // Validate slot_number
                    if (isNaN(slotNumber) || slotNumber < 0 || slotNumber > 5) {
                        console.warn(`Invalid slot number: ${row['Slot']}, skipping`);
                        return;
                    }

                    lastMaster.slots.push({
                        slot_number: slotNumber,
                        tidal_id: row['소속 ID']?.trim() || '',
                        slot_password: row['소속 PW']?.trim() || '',
                        order_number: row['주문번호']?.trim() || ''
                    });
                }
            }
        });

        // 0. Fetch Product ID for 'tidal'
        const { data: productData, error: productError } = await supabaseAdmin
            .from('products')
            .select('id')
            .eq('slug', 'tidal-hifi')
            .single();

        if (productError || !productData) {
            return NextResponse.json({ error: 'Tidal product not found' }, { status: 404 });
        }

        const mastersArray = Array.from(masterMap.values());
        console.log(`[Import] Processing ${mastersArray.length} master accounts...`);

        for (const master of mastersArray) {
            try {
                // Validate master account data
                if (!master.login_id || !master.payment_email) {
                    throw new Error('마스터 ID와 결제 계정은 필수입니다.');
                }

                // 1. Create or Update Master Account
                const { data: existingAcc } = await supabaseAdmin
                    .from('accounts')
                    .select('id')
                    .eq('login_id', master.login_id)
                    .single();

                let masterAccountId: string;

                if (existingAcc) {
                    // Update existing
                    console.log(`[Import] Updating existing master: ${master.login_id}`);
                    const { error: updateError } = await supabaseAdmin
                        .from('accounts')
                        .update({
                            payment_email: master.payment_email,
                            payment_day: master.payment_day,
                            memo: master.memo
                        })
                        .eq('id', existingAcc.id);

                    if (updateError) throw updateError;
                    masterAccountId = existingAcc.id;
                } else {
                    // Create new
                    console.log(`[Import] Creating new master: ${master.login_id}`);
                    const { data: newAcc, error: insertError } = await supabaseAdmin
                        .from('accounts')
                        .insert({
                            login_id: master.login_id,
                            login_pw: master.login_pw || null, // Allow null
                            payment_email: master.payment_email,
                            payment_day: master.payment_day,
                            memo: master.memo || '',
                            product_id: productData.id, // Use fetched UUID
                            max_slots: 6,
                            used_slots: 0
                        })
                        .select()
                        .single();

                    if (insertError) throw insertError;
                    masterAccountId = newAcc.id;
                    results.success.masters++;
                }

                // 2. Handle Slot Assignments
                for (const slot of master.slots) {
                    // Skip completely empty slots (no tidal_id AND no slot_password)
                    if (!slot.tidal_id && !slot.slot_password) continue;

                    try {
                        // Try to find the order if order_number is provided
                        let orderId = null;
                        if (slot.order_number) {
                            const { data: orderData } = await supabaseAdmin
                                .from('orders')
                                .select('id')
                                .eq('order_number', slot.order_number)
                                .maybeSingle();
                            if (orderData) {
                                orderId = orderData.id;
                            }
                        }

                        const slotData = {
                            account_id: masterAccountId,
                            slot_number: slot.slot_number,
                            tidal_id: slot.tidal_id || null,
                            slot_password: slot.slot_password || '',
                            order_id: orderId
                        };

                        // Strategy: Use different upsert methods based on data availability
                        if (slot.tidal_id && slot.tidal_id.trim()) {
                            // Case 1: tidal_id exists - Use tidal_id as conflict target
                            const { error: slotError } = await supabaseAdmin
                                .from('order_accounts')
                                .upsert(slotData, {
                                    onConflict: 'tidal_id',
                                    ignoreDuplicates: false
                                });

                            if (slotError) throw slotError;
                        } else {
                            // Case 2: No tidal_id - Use (account_id, slot_number) as identifier
                            // Check if slot already exists
                            const { data: existing } = await supabaseAdmin
                                .from('order_accounts')
                                .select('id')
                                .eq('account_id', masterAccountId)
                                .eq('slot_number', slot.slot_number)
                                .maybeSingle();

                            if (existing) {
                                // UPDATE existing slot
                                const { error: updateError } = await supabaseAdmin
                                    .from('order_accounts')
                                    .update({
                                        slot_password: slotData.slot_password,
                                        order_id: slotData.order_id,
                                        tidal_id: slotData.tidal_id
                                    })
                                    .eq('id', existing.id);

                                if (updateError) throw updateError;
                            } else {
                                // INSERT new slot
                                const { error: insertError } = await supabaseAdmin
                                    .from('order_accounts')
                                    .insert(slotData);

                                if (insertError) throw insertError;
                            }
                        }

                        results.success.slots++;
                    } catch (slotError: unknown) {
                        const e = slotError as Error;
                        console.error('Slot upsert error:', e);

                        // Provide more detailed error message
                        let errorMsg = e.message;
                        if (errorMsg.includes('unique constraint')) {
                            errorMsg = '중복된 Tidal ID 또는 슬롯 번호입니다.';
                        } else if (errorMsg.includes('ON CONFLICT')) {
                            errorMsg = 'DB 제약조건이 설정되지 않았습니다. Migration 020을 실행해주세요.';
                        }

                        results.failed.push({
                            id: `${master.login_id}-slot-${slot.slot_number + 1}`,
                            reason: `Slot ${slot.slot_number + 1}: ${errorMsg}`
                        });
                    }
                }

                // 3. Sync used_slots count after all slot operations
                const { count: actualCount } = await supabaseAdmin
                    .from('order_accounts')
                    .select('*', { count: 'exact', head: true })
                    .eq('account_id', masterAccountId);

                await supabaseAdmin
                    .from('accounts')
                    .update({ used_slots: actualCount || 0 })
                    .eq('id', masterAccountId);

                console.log(`[Import] Master ${master.login_id} completed. Slots: ${actualCount || 0}/6`);

            } catch (error: unknown) {
                const e = error as Error;
                console.error(`[Import] Master ${master.login_id} failed:`, e.message);
                results.failed.push({
                    id: master.login_id,
                    reason: e.message || 'Unknown error'
                });
            }
        }

        // Log final results
        console.log('[Import] ===== Import Summary =====');
        console.log(`[Import] Masters created: ${results.success.masters}`);
        console.log(`[Import] Slots created/updated: ${results.success.slots}`);
        console.log(`[Import] Failed items: ${results.failed.length}`);
        if (results.failed.length > 0) {
            console.log('[Import] Failed details:', results.failed);
        }

        return NextResponse.json(results);
    } catch (error: unknown) {
        const e = error as Error;
        console.error('[Import] Fatal error:', e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
