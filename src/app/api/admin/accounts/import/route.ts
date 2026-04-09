import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { reindexSlots, syncUsedSlots } from '@/lib/assignment-utils';

function parseExcelDate(value: unknown): string | null {
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
                    .from('tidal_accounts')
                    .select('id')
                    .eq('login_id', master.login_id)
                    .eq('product_id', productData.id)
                    .maybeSingle();

                let masterAccountId: string;

                if (existingAcc) {
                    // Update existing
                    console.log(`[Import] Updating existing master: ${master.login_id}`);
                    const masterUpdates: Record<string, string | number | null> = {};
                    if (master.payment_email) masterUpdates.payment_email = master.payment_email;
                    if (master.payment_day) masterUpdates.payment_day = master.payment_day;
                    if (master.memo !== null) masterUpdates.memo = master.memo;

                    const { error: updateError } = await supabaseAdmin
                        .from('tidal_accounts')
                        .update(masterUpdates)
                        .eq('id', existingAcc.id);

                    if (updateError) throw updateError;
                    masterAccountId = existingAcc.id;
                    results.success.masters.updated++;
                } else {
                    // Create new
                    console.log(`[Import] Creating new master: ${master.login_id}`);
                    const { data: newAcc, error: insertError } = await supabaseAdmin
                        .from('tidal_accounts')
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
                const slotTable = 'tidal_assignments';
                for (const slot of master.slots) {
                    // Skip completely empty slots
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
                        
                        // Check if the slot already exists
                        const { data: existingSlot } = await supabaseAdmin
                            .from(slotTable)
                            .select('id, tidal_id, order_id')
                            .eq('account_id', masterAccountId)
                            .eq('slot_number', slot.slot_number)
                            .maybeSingle();

                        if (!orderId && existingSlot?.order_id) {
                            orderId = existingSlot.order_id;
                        }

                        // If no order found, and we have an amount or customer info, let's create a guest order
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
                            if (!orderErr && newOrder) orderId = newOrder.id;
                        } else if (slot.amount !== null || slot.buyer_name || slot.buyer_email || slot.buyer_phone) {
                            // Update existing order
                            const orderUpdates: Record<string, string | number> = {};
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

                        const safeTidalId = slot.tidal_id ? slot.tidal_id : null;

                        // Check for existing master specifically for this group
                        const { data: currentMasterSlot } = await supabaseAdmin
                            .from(slotTable)
                            .select('slot_number')
                            .eq('account_id', masterAccountId)
                            .eq('type', 'master')
                            .maybeSingle();

                        let slotType = 'user';
                        if (slot.slot_number === 0) {
                            if (!currentMasterSlot || currentMasterSlot.slot_number === 0) {
                                slotType = 'master';
                            }
                        } else if (currentMasterSlot && currentMasterSlot.slot_number === slot.slot_number) {
                            slotType = 'master';
                        }

                        const slotData = {
                            account_id: masterAccountId,
                            slot_number: slot.slot_number,
                            tidal_id: safeTidalId,
                            tidal_password: slot.tidal_password || null,
                            order_id: orderId,
                            is_active: true,
                            is_deleted: false,
                            order_number: slot.order_number || null,
                            buyer_name: slot.buyer_name || null,
                            buyer_email: slot.buyer_email || null,
                            buyer_phone: slot.buyer_phone || null,
                            start_date: slot.start_date || null,
                            end_date: slot.end_date || null,
                            type: slotType,
                            amount: slot.amount,
                            period_months: slot.period_months,
                        };

                        // Clear existing tidal_id if it belongs to another slot
                        if (safeTidalId) {
                            const { data: existingByTidal } = await supabaseAdmin
                                .from(slotTable)
                                .select('id, account_id, slot_number')
                                .eq('tidal_id', safeTidalId)
                                .maybeSingle();

                            if (existingByTidal && (!existingSlot || existingByTidal.id !== existingSlot.id)) {
                                await supabaseAdmin
                                    .from(slotTable)
                                    .update({ tidal_id: null, tidal_password: null })
                                    .eq('id', existingByTidal.id);
                            }
                        }

                        if (existingSlot) {
                            const { error: updateError } = await supabaseAdmin
                                .from(slotTable)
                                .update(slotData)
                                .eq('id', existingSlot.id);
                            if (updateError) throw updateError;
                            results.success.slots.updated++;
                        } else {
                            const { error: insertError } = await supabaseAdmin
                                .from(slotTable)
                                .insert(slotData);
                            if (insertError) throw insertError;
                            results.success.slots.created++;
                        }
                    } catch (slotError) {
                        const se = slotError as Error;
                        results.failed.push({
                            id: `${master.login_id}-slot-${slot.slot_number + 1}`,
                            reason: `Slot ${slot.slot_number + 1}: ${se.message}`
                        });
                    }
                }

                // 3. Re-index and Sync
                await reindexSlots(masterAccountId, slotTable, 'tidal_accounts');
                await syncUsedSlots(masterAccountId, 'tidal_accounts', slotTable);

            } catch (error) {
                const e = error as Error;
                results.failed.push({
                    id: master.login_id,
                    reason: e.message || 'Unknown error'
                });
            }
        }

        return NextResponse.json(results);
    } catch (error) {
        const e = error as Error;
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
