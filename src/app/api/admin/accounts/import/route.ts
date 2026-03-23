import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

function parseExcelDate(value: any): string | null {
    if (!value) return null;
    if (typeof value === 'number') {
        const date = new Date((value - 25569) * 86400 * 1000);
        if (isNaN(date.getTime())) return null;
        return date.toISOString().split('T')[0];
    }
    if (typeof value === 'string') {
        const parsed = new Date(value);
        if (!isNaN(parsed.getTime())) {
            return parsed.toISOString().split('T')[0];
        }
    }
    return null;
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
    amount: number | null;
    period_months: number | null;
}

interface ImportAccount {
    login_id: string;
    payment_email: string;
    payment_day: number;
    login_pw: string;
    memo: string | null;
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
            const assignmentNum = String(row['배정번호'] || '').trim();
            
            let masterId: string, slotText: string;
            
            if (assignmentNum && assignmentNum.includes('-')) {
                const lastDashIndex = assignmentNum.lastIndexOf('-');
                masterId = assignmentNum.substring(0, lastDashIndex).trim();
                slotText = assignmentNum.substring(lastDashIndex + 1).trim();
            } else {
                masterId = String(row['마스터 ID'] || row['그룹 ID'] || '').trim();
                slotText = String(row['Slot'] || '').replace('Slot ', '').replace('#', '').trim();
            }
            if (!masterId && assignmentNum) masterId = assignmentNum;

            let currentMaster;

            if (masterId) {
                if (!masterMap.has(masterId)) {
                    masterMap.set(masterId, {
                        login_id: masterId,
                        payment_email: row['결제 계정'] !== undefined ? String(row['결제 계정']).trim() : '',
                        payment_day: parseInt(row['결제일']?.toString().replace('일', '') || '0') || 0,
                        login_pw: '', // Default to empty string to satisfy NOT NULL constraint
                        memo: row['메모'] !== undefined ? String(row['메모']).trim() : null, // keep null if not provided
                        slots: []
                    });
                } else {
                    const existing = masterMap.get(masterId);
                    if (existing) {
                        if (existing.memo === null || existing.memo === '') {
                            const newMemo = row['메모'] !== undefined ? String(row['메모']).trim() : null;
                            if (newMemo) existing.memo = newMemo;
                        }
                        if (!existing.payment_email && row['결제 계정']) {
                            existing.payment_email = String(row['결제 계정']).trim();
                        }
                        if (!existing.payment_day && row['결제일']) {
                            existing.payment_day = parseInt(row['결제일']?.toString().replace('일', '') || '0') || 0;
                        }
                    }
                }
                currentMaster = masterMap.get(masterId);
            } else if (masterMap.size > 0) {
                // It's a slot row for the last seen master (legacy format support)
                const masters = Array.from(masterMap.values());
                currentMaster = masters[masters.length - 1];
            }

            if (currentMaster && slotText) {
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

                    const startDate = parseExcelDate(row['시작일']);
                    const endDate = parseExcelDate(row['종료일']);
                    
                    const amountRaw = row['계약금액'] ?? row['결제금액'];
                    let amount = null;
                    if (amountRaw !== undefined && amountRaw !== null && amountRaw !== '') {
                        const sanitizedAmt = String(amountRaw).replace(/,/g, '');
                        if (!isNaN(parseInt(sanitizedAmt))) {
                            amount = parseInt(sanitizedAmt);
                        }
                    }

                    const periodRaw = row['개월'];
                    let period_months = null;
                    if (periodRaw !== undefined && periodRaw !== null && periodRaw !== '') {
                        if (!isNaN(parseInt(String(periodRaw)))) {
                            period_months = parseInt(String(periodRaw));
                        }
                    }

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
                        amount: amount,
                        period_months: period_months
                    });
                } else {
                    console.warn(`Invalid slot number: ${row['Slot']}, skipping`);
                }
            }
        });

        // 0. Fetch Product ID dynamically
        const productName = req.nextUrl.searchParams.get('product') || 'tidal';
        const { data: products, error: productError } = await supabaseAdmin
            .from('products')
            .select('id, name');

        if (productError || !products || products.length === 0) {
            return NextResponse.json({ error: 'No products found in the database' }, { status: 404 });
        }

        let productData;
        if (productName.toLowerCase().includes('hifi')) {
            productData = products.find(p => p.name.toLowerCase() === 'hifitidal') || products.find(p => p.name.toLowerCase().includes('hifitidal'));
        } else {
            productData = products.find(p => p.name.toLowerCase().includes('tidal') && !p.name.toLowerCase().includes('hifitidal')) || products[0];
        }

        if (!productData) {
            return NextResponse.json({ error: 'Matching product not found in the database. Ensure a product with the appropriate name exists.' }, { status: 404 });
        }

        let targetPlanId = null;
        const { data: plan } = await supabaseAdmin
            .from('product_plans')
            .select('id')
            .eq('product_id', productData.id)
            .limit(1)
            .maybeSingle();
        if (plan) {
            targetPlanId = plan.id;
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
                    .eq('product_id', productData.id)
                    .maybeSingle();

                let masterAccountId: string;

                if (existingAcc) {
                    // Update existing
                    console.log(`[Import] Updating existing master: ${master.login_id}`);
                    const masterUpdates: any = {};
                    if (master.payment_email) masterUpdates.payment_email = master.payment_email;
                    if (master.payment_day) masterUpdates.payment_day = master.payment_day;
                    if (master.memo !== null) masterUpdates.memo = master.memo;

                    const { error: updateError } = await supabaseAdmin
                        .from('accounts')
                        .update(masterUpdates)
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
                            payment_email: master.payment_email || '',
                            payment_day: master.payment_day || 1,
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
                    // Skip completely empty slots (no tidal_id AND no tidal_password AND no order_number AND no buyer_name AND no buyer_email AND no buyer_phone)
                    // If any identifying information exists, we import it.
                    if (!slot.tidal_id && !slot.tidal_password && !slot.order_number && !slot.buyer_name && !slot.buyer_email && !slot.buyer_phone) continue;

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
                        
                        // Check if the slot already exists to reuse its order_id if no explicit order_number was provided
                        const { data: existingSlot } = await supabaseAdmin
                            .from('order_accounts')
                            .select('id, tidal_id, order_id')
                            .eq('account_id', masterAccountId)
                            .eq('slot_number', slot.slot_number)
                            .maybeSingle();

                        if (!orderId && existingSlot?.order_id) {
                            orderId = existingSlot.order_id;
                        }

                        // If no order found, and we have an amount or customer info, let's create a guest order
                        // This mirrors the behavior in assign/route.ts, BUT ONLY for Tidal
                        const isHifiTidal = productData.name.toLowerCase().includes('hifitidal');
                        if (!isHifiTidal) {
                            if (!orderId) {
                                const { data: newOrder, error: orderErr } = await supabaseAdmin
                                    .from('orders')
                                    .insert([{
                                        user_id: null,
                                        product_id: productData.id,
                                        plan_id: targetPlanId,
                                        payment_status: 'paid',
                                        assignment_status: 'waiting',
                                        buyer_name: slot.buyer_name || '',
                                        buyer_phone: slot.buyer_phone || '',
                                        buyer_email: slot.buyer_email || '',
                                        order_number: slot.order_number || null,
                                        amount: slot.amount !== null ? slot.amount : 0,
                                        is_guest: true
                                    }])
                                    .select('id')
                                    .single();
                                if (orderErr) {
                                    console.error('[Import] Failed to create order:', orderErr);
                                }
                                if (newOrder) orderId = newOrder.id;
                            } else if (slot.amount !== null || slot.buyer_name || slot.buyer_email || slot.buyer_phone) {
                                // If order exists and we uploaded amount or customer info, update it
                                const orderUpdates: any = {};
                                if (slot.amount !== null) orderUpdates.amount = slot.amount;
                                if (slot.buyer_name) orderUpdates.buyer_name = slot.buyer_name;
                                if (slot.buyer_phone) orderUpdates.buyer_phone = slot.buyer_phone;
                                if (slot.buyer_email) orderUpdates.buyer_email = slot.buyer_email;
                                
                                if (Object.keys(orderUpdates).length > 0) {
                                    await supabaseAdmin
                                        .from('orders')
                                        .update(orderUpdates)
                                        .eq('id', orderId);
                                }
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
                            is_active: true,
                            order_number: slot.order_number || null,
                            buyer_name: slot.buyer_name || null,
                            buyer_email: slot.buyer_email || null,
                            buyer_phone: slot.buyer_phone || null,
                            start_date: slot.start_date || null,
                            end_date: slot.end_date || null,
                            type: slotType, // Apply determined type
                            amount: slot.amount,
                            period_months: slot.period_months,
                        };

                        // 1. We already checked existingSlot earlier, but we just use that variable.


                        // 2. Clear existing tidal_id if it belongs to another slot
                        if (safeTidalId) {
                            const { data: existingByTidal } = await supabaseAdmin
                                .from('order_accounts')
                                .select('id, account_id, slot_number')
                                .eq('tidal_id', safeTidalId)
                                .maybeSingle();
                                
                            if (existingByTidal && (!existingSlot || existingByTidal.id !== existingSlot.id)) {
                                console.log(`[Import] Tidal ID ${safeTidalId} is already in use at another slot. Removing old binding.`);
                                // Remove tidal_id from the old slot to prevent Unique Constraint Violation
                                await supabaseAdmin
                                    .from('order_accounts')
                                    .update({ tidal_id: null, tidal_password: null })
                                    .eq('id', existingByTidal.id);
                            }
                        }

                        const refinedSlotData = {
                            ...slotData,
                            tidal_id: safeTidalId || null,
                            tidal_password: slotData.tidal_password || null
                        };

                        if (existingSlot) {
                            // Update existing slot
                            const { error: updateError } = await supabaseAdmin
                                .from('order_accounts')
                                .update(refinedSlotData)
                                .eq('id', existingSlot.id);
                            
                            if (updateError) throw updateError;
                        } else {
                            // Insert new slot
                            const { error: insertError } = await supabaseAdmin
                                .from('order_accounts')
                                .insert(refinedSlotData);
                            
                            if (insertError) throw insertError;
                        }

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
