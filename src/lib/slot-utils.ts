/**
 * 계정 그룹의 슬롯 렌더 범위 계산.
 *
 * 중복 등록/이전 오류 등으로 활성 배정이 max_slots를 초과하면 slot_number가 max_slots 이상인
 * 행이 생긴다. 화면에서 max_slots까지만 순회하면 그 행들이 조용히 사라지고 슬롯 배지만
 * 7/6처럼 늘어나 원인 파악이 어렵다. 실제 배정된 최대 슬롯 번호까지 범위를 넓혀 초과분도
 * 반드시 노출시킨다.
 *
 * 정원 밖의 "빈" 자리는 배정 가능한 슬롯이 아니므로, 호출부에서 배정이 없는 i >= max_slots는
 * 빈 슬롯 행으로 만들지 않아야 한다.
 */
/**
 * 그룹의 마스터 배정을 찾는다.
 *
 * type이 'master'인 행이 원칙이지만, 엑셀 업로드 등으로 마스터 표시가 빠진 그룹이 있다.
 * 그 경우 그룹의 1번 사용자(slot_number 0)를 마스터로 간주해, 목록 헤더의 마스터계정/종료일/
 * 개월/금액이 비어 보이지 않도록 한다.
 */
export function findMasterAssignment<T extends { type?: string | null; slot_number?: number | null }>(
    assignments?: T[] | null
): T | undefined {
    const list = assignments || [];
    return list.find(a => a.type === 'master') ?? list.find(a => (a.slot_number ?? -1) === 0);
}

export function getSlotRenderCount(acc: {
    max_slots: number;
    order_accounts?: { slot_number?: number | null }[] | null;
}): number {
    const maxAssigned = (acc.order_accounts || []).reduce(
        (max, oa) => Math.max(max, (oa.slot_number ?? 0) + 1),
        0
    );
    return Math.max(acc.max_slots, maxAssigned);
}
