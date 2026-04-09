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

    // 3. Pass 1: Temporarily move to high indices to avoid unique constraint 23505
    for (const s of sorted) {
        await supabaseAdmin
            .from(assignmentTable)
            .update({ slot_number: (s.slot_number ?? 0) + 1000 })
            .eq('id', s.id);
    }

    // 4. Pass 2: Final sequential re-indexing starting from 0
    for (let i = 0; i < sorted.length; i++) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const updates: any = { slot_number: i };
        // Ensure only the first slot remains 'master' if somehow multiple masters exist
        if (i > 0 && sorted[i].type === 'master') {
            updates.type = 'user';
        }
        await supabaseAdmin
            .from(assignmentTable)
            .update(updates)
            .eq('id', sorted[i].id);
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
