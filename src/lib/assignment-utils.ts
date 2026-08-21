import { supabaseAdmin } from './supabaseAdmin';

/**
 * Common utilities for handling Tidal and Legacy Tidal assignments.
 */

/**
 * 슬롯 번호 고정 정책.
 *
 * 그룹 안의 슬롯 번호(1~6)는 관리자가 직접 옮기지 않는 한 변하지 않는다. 중간 슬롯을
 * 삭제/비활성하면 그 번호가 그대로 공란으로 남고, 뒤 번호를 당겨오지 않는다. 새 배정은
 * 가장 작은 빈 번호로 들어간다. 예전에는 여기서 0..n-1로 재인덱싱했기 때문에 삭제한 번호가
 * 아니라 마지막 번호가 비어 보였고, 남아 있는 사용자들의 배정번호(HA01-3 등)까지 바뀌었다.
 *
 * 그래서 이 함수는 slot_number를 건드리지 않고 마스터 표시와 used_slots만 정리한다.
 */
export async function normalizeSlots(
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

    // 정원 초과 감지. 데이터를 임의로 버릴 수는 없으니 여기서는 경고만 남기고,
    // 실제 차단은 배정 생성 시점(assign 라우트)에서 한다.
    const { data: account } = await supabaseAdmin
        .from(accountTable)
        .select('max_slots')
        .eq('id', accountId)
        .single();

    if (account && slots.length > account.max_slots) {
        console.warn(
            `[normalizeSlots] 정원 초과: account=${accountId} (${assignmentTable}) ` +
            `배정 ${slots.length}건 > 정원 ${account.max_slots}개. 중복 배정 여부를 확인하세요.`
        );
    }

    // 2. 마스터는 항상 한 건만 유지한다. (슬롯 번호는 그대로 둔다)
    //    - 마스터가 여러 건이면 가장 작은 슬롯 번호만 남기고 나머지는 user로 내린다.
    //    - 마스터가 없으면(마스터 슬롯 하드 삭제 후) 가장 작은 슬롯 번호를 승격시킨다.
    //      번호를 당기지 않으므로 승격된 슬롯이 0번이 아닐 수도 있다.
    const master = slots.find(s => s.type === 'master') ?? slots[0];

    for (const slot of slots) {
        const newType = slot.id === master.id ? 'master' : (slot.type === 'master' ? 'user' : slot.type);

        // 불필요한 updated_at 갱신을 막기 위해 실제로 바뀔 때만 업데이트
        if (newType !== slot.type) {
            await supabaseAdmin
                .from(assignmentTable)
                .update({ type: newType })
                .eq('id', slot.id);
        }
    }

    // 3. Sync used_slots to the account
    await syncUsedSlots(accountId, accountTable, assignmentTable);
}

/**
 * 계정에서 비어 있는 가장 작은 슬롯 번호를 찾는다.
 *
 * 삭제되지 않은 배정(비활성 포함)이 점유한 번호는 건너뛴다. 비활성 슬롯도 화면에 자기 번호로
 * 남아 있으므로 점유 상태로 본다. 정원(max_slots) 초과 여부는 호출부에서 판단한다.
 */
export function findFirstEmptySlot(
    assignments: { slot_number?: number | null; is_deleted?: boolean | null }[] | null | undefined
): number {
    const occupied = new Set(
        (assignments || [])
            .filter(a => a.is_deleted !== true)
            .map(a => a.slot_number ?? -1)
    );

    let candidate = 0;
    while (occupied.has(candidate)) candidate++;
    return candidate;
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
