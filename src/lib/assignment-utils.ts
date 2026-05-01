import { supabaseAdmin } from './supabaseAdmin';

/**
 * Common utilities for handling Tidal and Legacy Tidal assignments.
 */

export async function reindexSlots(
    accountId: string,
    assignmentTable: 'tidal_assignments' | 'legacy_tidal_assignments',
    accountTable: 'tidal_accounts' | 'legacy_tidal_accounts'
) {
    // 1. Fetch current non-deleted assignments
    const { data: slots, error: fetchError } = await supabaseAdmin
        .from(assignmentTable)
        .select('id, slot_number, type')
        .eq('account_id', accountId)
        .eq('is_deleted', false)
        .order('slot_number', { ascending: true });

    if (fetchError) throw fetchError;
    if (!slots || slots.length === 0) {
        await syncUsedSlots(accountId, accountTable, assignmentTable);
        return;
    }

    // 2. Sort: master at top, others by current slot_number
    const sorted = [...slots].sort((a, b) => {
        if (a.type === 'master' && b.type !== 'master') return -1;
        if (b.type === 'master' && a.type !== 'master') return 1;
        return (a.slot_number ?? 0) - (b.slot_number ?? 0);
    });

    // 3. Final sequential re-indexing starting from 0
    // Only update if slot_number or type actually changed to avoid unnecessary DB triggers (updated_at)
    for (let i = 0; i < sorted.length; i++) {
        const slot = sorted[i];
        const newSlotNumber = i;
        const newType = (i > 0 && slot.type === 'master') ? 'user' : slot.type;

        // Check if anything actually changed
        const needsUpdate = slot.slot_number !== newSlotNumber || slot.type !== newType;

        if (needsUpdate) {
            const updates: any = {};
            if (slot.slot_number !== newSlotNumber) updates.slot_number = newSlotNumber;
            if (slot.type !== newType) updates.type = newType;

            await supabaseAdmin
                .from(assignmentTable)
                .update(updates)
                .eq('id', slot.id);
        }
    }

    // 5. Sync used_slots to the account
    await syncUsedSlots(accountId, accountTable, assignmentTable);
}

/**
 * Syncs the 'used_slots' count of an account based on its active, non-deleted assignments.
 */
export async function syncUsedSlots(
    accountId: string,
    accountTable: 'tidal_accounts' | 'legacy_tidal_accounts',
    assignmentTable: 'tidal_assignments' | 'legacy_tidal_assignments'
) {
    const { count, error } = await supabaseAdmin
        .from(assignmentTable)
        .select('*', { count: 'exact', head: true })
        .eq('account_id', accountId)
        .eq('is_active', true)
        .eq('is_deleted', false);

    if (error) throw error;

    await supabaseAdmin
        .from(accountTable)
        .update({ used_slots: count || 0 })
        .eq('id', accountId);
}
