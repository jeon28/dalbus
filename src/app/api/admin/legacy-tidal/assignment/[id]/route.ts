import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { normalizePhone } from '@/lib/utils';
import { getServerSession, isAdmin } from '@/lib/auth';
import { reindexSlots, syncUsedSlots } from '@/lib/assignment-utils';

export const dynamic = 'force-dynamic';

const assignmentTable = 'legacy_tidal_assignments';
const accountTable = 'legacy_tidal_accounts';

// PUT: Update legacy assignment details
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await getServerSession(req);
        if (!session || !isAdmin(session)) {
            return NextResponse.json({ error: 'Admin role required' }, { status: 403 });
        }

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
            memo: _memo
        } = body;

        // 1. Fetch current assignment data
        const { data: current, error: fetchError } = await supabaseAdmin
            .from(assignmentTable)
            .select('*')
            .eq('id', id)
            .single();

        if (fetchError || !current) {
            throw new Error('Assignment not found');
        }

        const updates: Record<string, string | number | boolean | null> = {};
        
        // Helper to check if value changed and add to updates
        const addIfChanged = (key: string, newValue: any) => {
            if (newValue === undefined) return;
            
            let val = newValue;
            if (key === 'tidal_id') val = val ? val.toLowerCase().trim() : null;
            if (key === 'buyer_phone') val = normalizePhone(val);
            if (key === 'amount' || key === 'period_months') val = val !== null ? Number(val) : null;

            if (current[key] !== val) {
                updates[key] = val;
            }
        };

        addIfChanged('tidal_password', tidal_password);
        addIfChanged('tidal_id', tidal_id);
        addIfChanged('order_number', body.order_number);
        addIfChanged('type', type);
        addIfChanged('buyer_name', buyer_name);
        addIfChanged('buyer_phone', buyer_phone);
        addIfChanged('buyer_email', buyer_email);
        addIfChanged('start_date', start_date);
        addIfChanged('end_date', end_date);
        addIfChanged('is_active', is_active);
        addIfChanged('is_deleted', body.is_deleted);
        addIfChanged('amount', amount);
        addIfChanged('period_months', period_months);
        addIfChanged('memo', _memo);

        if (Object.keys(updates).length > 0) {
            const { error: updateError } = await supabaseAdmin
                .from(assignmentTable)
                .update(updates)
                .eq('id', id);

            if (updateError) throw updateError;

            // Re-index slots if type, is_active, or is_deleted actually changed
            const structuralChanged = 
                updates.type !== undefined || 
                updates.is_active !== undefined || 
                updates.is_deleted !== undefined;

            if (structuralChanged) {
                await reindexSlots(current.account_id, assignmentTable, accountTable);
                // syncUsedSlots is already called inside reindexSlots
            } else if (updates.is_active !== undefined) {
                // If only is_active changed but not others, reindexSlots calls syncUsedSlots anyway.
                // But we already covered is_active in structuralChanged.
            }
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}

// DELETE: Soft or Hard delete legacy assignment
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await getServerSession(req);
        if (!session || !isAdmin(session)) {
            return NextResponse.json({ error: 'Admin role required' }, { status: 403 });
        }

        const { id } = await params;
        const hardDelete = req.nextUrl.searchParams.get('hardDelete') === 'true';

        const { data: assignment, error: fetchError } = await supabaseAdmin
            .from(assignmentTable)
            .select('account_id')
            .eq('id', id)
            .single();

        if (fetchError || !assignment) throw new Error('Assignment not found');

        if (hardDelete) {
            const { error } = await supabaseAdmin
                .from(assignmentTable)
                .delete()
                .eq('id', id);
            if (error) throw error;
        } else {
            const { error } = await supabaseAdmin
                .from(assignmentTable)
                .update({ is_deleted: true, is_active: false })
                .eq('id', id);
            if (error) throw error;
        }

        // 3. Re-index and Sync
        await reindexSlots(assignment.account_id, assignmentTable, accountTable);

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}
