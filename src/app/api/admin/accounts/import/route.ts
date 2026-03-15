import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// Excel date serial → ISO date string (e.g. 46095 → '2026-03-14')
function excelDateToISO(serial: number | undefined | null): string | null {
    if (!serial || typeof serial !== 'number') return null;
    // Excel epoch is Jan 1, 1900; JS epoch is Jan 1, 1970
    // 25569 = days between the two epochs
    const date = new Date((serial - 25569) * 86400 * 1000);
    if (isNaN(date.getTime())) return null;
    return date.toISOString().split('T')[0];
}

interface ImportSlot {
    slot_number: number;
    tidal_id: string | null;
    tidal_password: string | null;
    order_number: string | null;
    buyer_name: string | null;
    buyer_email: string | null;
    buyer_phone: string | null;
    start_date: string | null;
    end_date: string | null;
}

interface ImportAccount {
    login_id: string;
    payment_email: string;
    payment_day: number;
    login_pw: string;
    memo: string;
    slots: ImportSlot[];
}

export async function POST(req: NextRequest) {
    try {
        const { accounts: importData } = await req.json();

        if (!importData || !Array.isArray(importData)) {
            return NextResponse.json({ error: 'Invalid data format' }, { status: 400 });
        }

        const results = {
            success: {
                masters: { created: 0, updated: 0 },
                slots: { created: 0, updated: 0 }
            },
            failed: [] as { id: string; reason: string }[],
        };

        // Group data by Master ID (login_id)
        const masterMap = new Map<string, ImportAccount>();
        importData.forEach((row) => {
            const masterId = row['마스터 ID'] || row['그룹 ID'];
            
            let currentMaster;

            if (masterId) {
                if (!masterMap.has(masterId)) {
                    masterMap.set(masterId, {
                        login_id: masterId,
                        payment_email: row['결제 계정'] || '',
                        payment_day: parseInt(row['결제일']?.toString().replace('일', '') || '1'),
                        login_pw: '', // Default to empty string to satisfy NOT NULL constraint
                        memo: row['메모'] || '',
                        slots: []
                    });
                }
                currentMaster = masterMap.get(masterId);
            } else if (masterMap.size > 0) {
                // It's a slot row for the last seen master (legacy format support)
                currentMaster = Array.from(masterMap.values()).pop();
            }

            if (currentMaster && row['Slot']) {
                const slotText = String(row['Slot']).replace('Slot ', '').replace('#', '').trim();
                const slotNumber = parseInt(slotText) - 1;

                // Validate slot_number
                if (!isNaN(slotNumber) && slotNumber >= 0 && slotNumber <= 5) {
                    const mappedTidalId = String(row['소속 ID'] || '')?.trim();
                    const mappedPassword = String(row['소속 PW'] || '')?.trim();
                    // 주문번호: keep as string (may be number in Excel)
                    const rawOrderNum = row['주문번호'];
                    const mappedOrderNum = rawOrderNum != null ? String(rawOrderNum).trim() : null;

                    // Customer info from Excel
                    const buyerName = String(row['고객명'] || '').trim() || null;
                    const buyerEmail = String(row['이메일'] || '').trim() || null;
                    const buyerPhone = String(row['전화번호'] || '').trim() || null;

                    // Start/end dates: stored as Excel serial numbers
                    const startDate = excelDateToISO(row['시작일'] as number);
                    const endDate = excelDateToISO(row['종료일'] as number);

                    currentMaster.slots.push({
                        slot_number: slotNumber,
                        tidal_id: mappedTidalId === '' ? null : mappedTidalId,
                        tidal_password: mappedPassword === '' ? null : mappedPassword,
                        order_number: mappedOrderNum === '' ? null : mappedOrderNum,
                        buyer_name: buyerName,
                        buyer_email: buyerEmail,
                        buyer_phone: buyerPhone,
                        start_date: startDate,
                        end_date: endDate,
                    });
                } else {
                    console.warn(`Invalid slot number: ${row['Slot']}, skipping`);
                }
            }
        });

        // 0. Fetch Product ID for 'tidal'
        const { data: products, error: productError } = await supabaseAdmin
            .from('products')
            .select('id, name');

        if (productError || !products || products.length === 0) {
            return NextResponse.json({ error: 'No products found in the database' }, { status: 404 });
        }

        const productData = products.find(p => p.name.toLowerCase().includes('tidal') || p.name.includes('타이달')) || products[0];

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
                    results.success.masters.updated++;
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
                    results.success.masters.created++;
                }

                // 2. Handle Slot Assignments
                for (const slot of master.slots) {
                    // Skip completely empty slots (no tidal_id AND no tidal_password)
                    if (!slot.tidal_id && !slot.tidal_password) continue;

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

                        // Safely handle empty strings for unique constraints
                        const safeTidalId = slot.tidal_id ? slot.tidal_id : null;

                        // 2.1 Check for existing master specifically for this group
                        const { data: currentMasterSlot } = await supabaseAdmin
                            .from('order_accounts')
                            .select('slot_number')
                            .eq('account_id', masterAccountId)
                            .eq('type', 'master')
                            .maybeSingle();

                        // Determine slot type: Slot 1 is master if no other master exists
                        let slotType = 'user';
                        if (slot.slot_number === 0) {
                            if (!currentMasterSlot || currentMasterSlot.slot_number === 0) {
                                slotType = 'master';
                            }
                        } else {
                            if (currentMasterSlot && currentMasterSlot.slot_number === slot.slot_number) {
                                slotType = 'master';
                            }
                        }

                        const slotData = {
                            account_id: masterAccountId,
                            slot_number: slot.slot_number,
                            tidal_id: safeTidalId,
                            tidal_password: slot.tidal_password || '',
                            order_id: orderId,
                            order_number: slot.order_number || null,
                            buyer_name: slot.buyer_name || null,
                            buyer_email: slot.buyer_email || null,
                            buyer_phone: slot.buyer_phone || null,
                            start_date: slot.start_date || null,
                            end_date: slot.end_date || null,
                            type: slotType, // Apply determined type
                        };

                        // INSERT with UPSERT to prevent unique constraint conflicts on (account_id, slot_number)
                        // Check if slot specifically exists to differentiate between created and updated
                        const { data: existingSlot } = await supabaseAdmin
                            .from('order_accounts')
                            .select('id')
                            .eq('account_id', masterAccountId)
                            .eq('slot_number', slot.slot_number)
                            .maybeSingle();

                        const { error: upsertError } = await supabaseAdmin
                            .from('order_accounts')
                            .upsert(slotData, { 
                                onConflict: 'account_id, slot_number',
                                ignoreDuplicates: false 
                            });

                        if (upsertError) throw upsertError;

                        if (existingSlot) {
                            results.success.slots.updated++;
                        } else {
                            results.success.slots.created++;
                        }
                    } catch (slotError: unknown) {
                        const e = slotError as Error & { code?: string };
                        console.error('Slot upsert error:', e);

                        // Provide more detailed error message
                        let errorMsg = e.message;
                        if (errorMsg.includes('unique constraint') || e.code === '23505') {
                            errorMsg = '이미 동일한 Tidal ID 또는 슬롯 번호가 DB에 존재합니다. 엑셀 파일의 중복 여부를 확인해 주세요.';
                        } else if (errorMsg.includes('ON CONFLICT') || errorMsg.includes('no unique or exclusion constraint')) {
                            errorMsg = '[DB 설정 필요] 슬롯 중복 방지 제약 조건이 운영 DB에 설정되어 있지 않습니다. Supabase 대시보드 → SQL Editor에서 supabase/migrations/020_add_unique_tidal_id.sql 파일의 내용을 실행해주세요.';
                        } else if (errorMsg.includes('violates not-null') || e.code === '23502') {
                            errorMsg = '필수 입력 값이 비어있습니다. 엑셀 파일의 해당 슬롯 행을 확인해 주세요.';
                        } else if (errorMsg.includes('foreign key') || e.code === '23503') {
                            errorMsg = '연결된 마스터 계정이 존재하지 않습니다. 마스터 ID를 먼저 확인해 주세요.';
                        }

                        results.failed.push({
                            id: `${master.login_id}-slot-${slot.slot_number + 1}`,
                            reason: `Slot ${slot.slot_number + 1}: ${errorMsg}`
                        });
                    }
                }

                // 3. Re-index slots for this account to ensure sequentiality and master at 0
                const { data: finalSlots, error: finalFetchError } = await supabaseAdmin
                    .from('order_accounts')
                    .select('id, slot_number, type')
                    .eq('account_id', masterAccountId)
                    .order('slot_number', { ascending: true });

                if (!finalFetchError && finalSlots && finalSlots.length > 0) {
                    const sorted = [...finalSlots].sort((a, b) => {
                        if (a.type === 'master') return -1;
                        if (b.type === 'master') return 1;
                        return a.slot_number - b.slot_number;
                    });

                    // Pass 1: Move to temporary high slots
                    for (let i = 0; i < sorted.length; i++) {
                        await supabaseAdmin
                            .from('order_accounts')
                            .update({ slot_number: sorted[i].slot_number + 1000 })
                            .eq('id', sorted[i].id);
                    }

                    // Pass 2: Assign final sequential slot numbers (0, 1, 2...)
                    for (let i = 0; i < sorted.length; i++) {
                        const updates: { slot_number: number; type?: string } = { slot_number: i };
                        if (i > 0 && sorted[i].type === 'master') updates.type = 'user';

                        await supabaseAdmin
                            .from('order_accounts')
                            .update(updates)
                            .eq('id', sorted[i].id);
                    }
                }

                // 4. Sync used_slots count after all slot operations
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
        console.log(`[Import] Masters: Created=${results.success.masters.created}, Updated=${results.success.masters.updated}`);
        console.log(`[Import] Slots: Created=${results.success.slots.created}, Updated=${results.success.slots.updated}`);
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
