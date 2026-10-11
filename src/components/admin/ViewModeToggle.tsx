import { Layers, List } from 'lucide-react';

/**
 * 관리자 계정 화면 보기 방식 전환.
 * 개별 보기 = 하부계정(슬롯) 한 줄씩 펼친 표, 그룹 보기 = 대표계정(그룹)별로 묶은 목록.
 * 현재 보기가 눌린 상태로 표시되어 지금 어느 보기인지 바로 알 수 있다.
 */
export function ViewModeToggle({ isGridView, onChange }: { isGridView: boolean; onChange: (isGridView: boolean) => void }) {
    const base = 'h-8 px-3 inline-flex items-center gap-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition-colors';
    const on = 'bg-white text-blue-700 shadow-sm';
    const off = 'text-slate-500 hover:text-slate-800';
    return (
        <div role="group" aria-label="보기 방식" className="inline-flex items-center gap-0.5 p-0.5 bg-slate-100 border border-slate-200 rounded-lg">
            <button type="button" aria-pressed={isGridView} onClick={() => onChange(true)} className={`${base} ${isGridView ? on : off}`}>
                <List size={14} /> 개별 보기
            </button>
            <button type="button" aria-pressed={!isGridView} onClick={() => onChange(false)} className={`${base} ${!isGridView ? on : off}`}>
                <Layers size={14} /> 그룹 보기
            </button>
        </div>
    );
}
