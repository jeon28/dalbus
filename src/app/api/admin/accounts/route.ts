import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getServerSession, isAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// GET: Fetch all accounts
export async function GET(req: NextRequest) {
    try {
        const session = await getServerSession(req);
        if (!session) {
            return NextResponse.json({ error: 'Session not found or invalid' }, { status: 401 });
        }
        if (!isAdmin(session)) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            console.warn('[Accounts API] User is not an admin:', session.email, 'Role:', (session as any).role);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return NextResponse.json({ error: 'Admin role required', role: (session as any).role }, { status: 403 });
        }

        const productName = req.nextUrl.searchParams.get('product');

        let processedData;

        if (productName?.toLowerCase().includes('hifi')) {
            const { data, error } = await supabaseAdmin
                .from('accounts')
                .select(`
                    *,
                    products!inner(name, slug),
                    legacy_tidal_account(
                        id,
                        assigned_at,
                        slot_number,
                        tidal_password,
                        tidal_id,
                        type,
                        buyer_name,
                        buyer_phone,
                        buyer_email,
                        order_number,
                        start_date,
                        end_date,
                        period_months,
                        amount,
                        memo,
                        is_active,
                        is_deleted
                    )
                `)
                .neq('status', 'disabled')
                .ilike('products.slug', '%hifitidal%')
                .order('created_at', { ascending: false });

            if (error) throw error;
            
            processedData = data?.map(acc => ({
                ...acc,
                order_accounts: acc.legacy_tidal_account || []
            }));
            
            // Filter the outer array just in case
            processedData = processedData?.filter(account => {
                const pSlug = account.products?.slug || '';
                return pSlug === 'hifitidal';
            });
        } else {
            const { data, error } = await supabaseAdmin
                .from('accounts')
                .select(`
                    *,
                    products ( name, slug ),
                    order_accounts(
                        id,
                        assigned_at,
                        slot_number,
                        tidal_password,
                        tidal_id,
                        type,
                        buyer_name,
                        buyer_phone,
                        buyer_email,
                        order_number,
                        start_date,
                        end_date,
                        period_months,
                        amount,
                        memo,
                        is_active,
                        is_deleted,
                        orders(
                            id,
                            order_number,
                            created_at,
                            amount,
                            payment_status,
                            assignment_status,
                            user_id,
                            profiles(name, phone, email, memo),
                            product_plans(duration_months),
                            products(name)
                        )
                    )
                `)
                .neq('status', 'disabled')
                .order('created_at', { ascending: false });

            if (error) throw error;
            
            processedData = data;
            if (productName && processedData) {
                processedData = processedData.filter(account => {
                    const pSlug = account.products?.slug || '';
                    return pSlug !== 'hifitidal';
                });
            }
        }

        // Filter out inactive assignments, re-sort by slot_number, and recalculate used_slots locally for accuracy
        const filteredData = processedData?.map(account => {
            const { searchParams } = new URL(req.url);
            const showInactive = searchParams.get('showInactive') === 'true';
            const showDeleted = searchParams.get('showDeleted') === 'true';

            const assignments = (account.order_accounts || [])
                .filter((oa: { is_active?: boolean; is_deleted?: boolean }) => {
                    if (showDeleted) return oa.is_deleted === true;
                    if (showInactive) return oa.is_deleted !== true; // Show all non-deleted (both active and inactive)
                    return oa.is_active !== false && oa.is_deleted !== true; // Show only active, non-deleted
                })
                .sort((a: { slot_number: number }, b: { slot_number: number }) => a.slot_number - b.slot_number);
            return {
                ...account,
                order_accounts: assignments,
                used_slots: assignments.filter((oa: { is_active?: boolean; is_deleted?: boolean }) => oa.is_active !== false && oa.is_deleted !== true).length
            };
        });

        return NextResponse.json(filteredData);
    } catch (error) {
        const e = error as Error;
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

// POST: Create a new shared account
export async function POST(req: NextRequest) {
    try {
        const session = await getServerSession(req);
        if (!session) {
            return NextResponse.json({ error: 'Session not found or invalid' }, { status: 401 });
        }
        if (!isAdmin(session)) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            console.warn('[Accounts API POST] User is not an admin:', session.email, 'Role:', (session as any).role);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return NextResponse.json({ error: 'Admin role required', role: (session as any).role }, { status: 403 });
        }

        const body = await req.json();
        // body: product_id, login_id, login_pw, payment_email, payment_day, max_slots, memo

        const normalizedBody = {
            ...body,
            login_id: body.login_id ? body.login_id.toLowerCase().trim() : body.login_id,
            payment_email: body.payment_email ? body.payment_email.toLowerCase().trim() : body.payment_email
        };

        const { data, error } = await supabaseAdmin
            .from('accounts')
            .insert([normalizedBody])
            .select()
            .single();


        if (error) throw error;

        return NextResponse.json(data);
    } catch (error) {
        const e = error as Error;
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
