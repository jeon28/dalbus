import os

file_path = r'c:\Users\전성현\dalbus\src\app\(protected)\admin\tidal\page.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# find tbody
tbody_start_idx = -1
tbody_end_idx = -1

for idx, line in enumerate(lines):
    if '<tbody>' in line and idx > 1200:
        tbody_start_idx = idx
    if '</tbody>' in line and idx > (tbody_start_idx + 10):
        tbody_end_idx = idx
        break

if tbody_start_idx != -1 and tbody_end_idx != -1:
    new_tbody = """                            <tbody>
                                {(() => {
                                    const flattened = getFlattenedAssignments();
                                    if (sortConfig) {
                                        flattened.sort((a, b) => {
                                            let aVal = null;
                                            let bVal = null;
                                            switch (sortConfig.key) {
                                                case 'start_date': aVal = a.assignment.start_date; bVal = b.assignment.start_date; break;
                                                case 'end_date': aVal = a.assignment.end_date; bVal = b.assignment.end_date; break;
                                                case 'period': aVal = a.period; bVal = b.period; break;
                                                case 'login_id': aVal = a.account.login_id; bVal = b.account.login_id; break;
                                                case 'buyer_email': aVal = a.assignment.buyer_email || a.assignment.orders?.buyer_email; bVal = b.assignment.buyer_email || b.assignment.orders?.buyer_email; break;
                                                case 'amount': aVal = a.assignment.orders?.amount; bVal = b.assignment.orders?.amount; break;
                                                default: return 0;
                                            }
                                            const safeA = aVal || '';
                                            const safeB = bVal || '';
                                            if (safeA < safeB) return sortConfig.direction === 'asc' ? -1 : 1;
                                            if (safeA > safeB) return sortConfig.direction === 'asc' ? 1 : -1;
                                            return 0;
                                        });
                                    }
                                    return flattened.map((item) => {
                                        const assignment = item.assignment;
                                        const acc = item.account;
                                        const sIdx = assignment.slot_number;
                                        const key = `${acc.id}_${sIdx}`;
                                        const val = gridValues[key] || {};
                                        const isLastSaved = lastSavedKey === assignment.id || lastSavedKey === key;
                                        const today = new Date();
                                        today.setHours(0, 0, 0, 0);
                                        const isExpired = assignment.end_date ? parseISO(assignment.end_date) < today : false;
                                        const isEmpty = !!(assignment.id && assignment.id.startsWith('empty_'));
                                        const isDeactivated = val.is_active === false;

                                        return (
                                            <tr key={assignment.id} className={`${isDeactivated ? 'bg-red-50 text-red-500' : (isExpired ? 'bg-orange-50' : (isLastSaved ? 'bg-blue-50 animate-pulse' : 'hover:bg-gray-50'))} border-b`}>
                                                <td className="text-center py-2 border-r border-gray-200">
                                                    <input type="checkbox" checked={selectedAssignmentIds.has(assignment.id)} onChange={() => handleToggleSelection(assignment.id)} />
                                                </td>
                                                <td className="p-2 border-r text-center text-xs font-bold">{acc.login_id}-{sIdx + 1}</td>
                                                <td className="p-2 border-r text-center">{assignment.type === 'master' ? 'M' : 'U'}</td>
                                                <td className="p-2 border-r text-left overflow-hidden text-ellipsis whitespace-nowrap">{val.tidal_id || '-'}</td>
                                                <td className="p-2 border-r text-left font-mono text-xs">{val.tidal_password || '-'}</td>
                                                <td className="p-2 border-r text-left">{val.buyer_name || '-'}</td>
                                                <td className="p-2 border-r text-left text-xs overflow-hidden text-ellipsis whitespace-nowrap">{val.buyer_email || '-'}</td>
                                                <td className="p-2 border-r text-left text-xs">{val.buyer_phone || '-'}</td>
                                                <td className="p-2 border-r text-center text-xs font-mono">{val.order_number || '-'}</td>
                                                <td className="p-2 border-r text-center text-xs">{val.start_date || '-'}</td>
                                                <td className="p-2 border-r text-center text-xs">{val.end_date || '-'}</td>
                                                <td className="p-2 border-r text-center">{getPeriodMonths(val.start_date, val.end_date)}</td>
                                                <td className="p-2 border-r text-right">{val.amount?.toLocaleString() || '0'}</td>
                                                <td className="p-2 border-r text-center text-xs">{val.type}</td>
                                                <td className="p-2 text-center">
                                                    <div className="flex items-center justify-center gap-1">
                                                        {isEmpty ? (
                                                            <Button size="sm" onClick={() => openAssignModal(acc, sIdx)}>배정</Button>
                                                        ) : (
                                                            <>
                                                                <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-gray-400 hover:text-blue-600" title="수정" onClick={() => openEditAssignModal(key, val)}><Pencil size={14} /></Button>
                                                                <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-gray-400 hover:text-blue-600" title="이동" onClick={() => openMoveModal(assignment)}><ArrowRightLeft size={14} /></Button>
                                                                <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-gray-400 hover:text-orange-600" title="비활성화" onClick={() => handleDeactivate(assignment.id)}><PowerOff size={14} /></Button>
                                                                <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-gray-400 hover:text-red-600" title="삭제" onClick={() => handleDelete(assignment.id)}><Trash2 size={14} /></Button>
                                                            </>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    });
                                })()}
                            </tbody>
"""
    lines[tbody_start_idx : tbody_end_idx + 1] = [new_tbody]
    with open(file_path, 'w', encoding='utf-8') as f:
        f.writelines(lines)
    print("Successfully replaced tbody with clean code.")
else:
    print(f"Indices not found: {tbody_start_idx}, {tbody_end_idx}")
