import os

file_path = r'c:\Users\전성현\dalbus\src\app\(protected)\admin\tidal\page.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Line 1409 (1-indexed) is index 1408
# Correcting lines 1409-1414
new_return_block = """                                        return (
                                            <tr key={assignment.id} className={`${isDeactivated ? 'bg-red-50 text-red-500' : (isExpired ? 'bg-orange-50' : (isLastSaved ? 'bg-blue-50 animate-pulse' : 'hover:bg-gray-50'))} border-b`}>
                                                <td className="text-center py-2 border-r border-gray-200">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedAssignmentIds.has(assignment.id)}
                                                        onChange={() => handleToggleSelection(assignment.id)}
                                                    />
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
                                                                <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-gray-400 hover:text-blue-600" title="수정" onClick={() => openEditAssignModal(key, val)}>
                                                                    <Pencil size={14} />
                                                                </Button>
                                                                <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-gray-400 hover:text-blue-600" title="이동" onClick={() => openMoveModal(assignment)}>
                                                                    <ArrowRightLeft size={14} />
                                                                </Button>
                                                                <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-gray-400 hover:text-orange-600" title="비활성화 (종료)" onClick={() => handleDeactivate(assignment.id)}>
                                                                    <PowerOff size={14} />
                                                                </Button>
                                                                <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-gray-400 hover:text-red-600" title="삭제 (배정해제)" onClick={() => handleDelete(assignment.id)}>
                                                                    <Trash2 size={14} />
                                                                </Button>
                                                            </>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
"""

# Replace lines 1409 to 1414 (exclusive of line 1415)
# lines[1408:1414] covers indices 1408, 1409, 1410, 1411, 1412, 1413 (1-indexed lines 1409-1414)
lines[1408:1414] = [new_return_block]

with open(file_path, 'w', encoding='utf-8') as f:
    f.writelines(lines)

print("Successfully updated the return block.")
