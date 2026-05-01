const fs = require('fs');
const path = 'c:/Users/전성현/dalbus/src/app/(protected)/admin/tidal/page.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Add States
if (!content.includes('const [showInactive, setShowInactive]')) {
    content = content.replace(
        'const [showExpiredOnly, setShowExpiredOnly] = useState(false);',
        'const [showExpiredOnly, setShowExpiredOnly] = useState(false);\n    const [showInactive, setShowInactive] = useState(true);'
    );
}
if (!content.includes('const [isEditAssignModalOpen')) {
    content = content.replace(
        'const [memoTargetAssignmentId, setMemoTargetAssignmentId] = useState(\'\');',
        'const [memoTargetAssignmentId, setMemoTargetAssignmentId] = useState(\'\');\n    const [isEditAssignModalOpen, setIsEditAssignModalOpen] = useState(false);\n    const [editAssignData, setEditAssignData] = useState<any>(null);\n    const [editAssignKey, setEditAssignKey] = useState<string | null>(null);'
    );
}

// 2. Update GridView Row
const gridRowRegex = /return\s*\(\s*<tr\s+key=\{assignment\.id\}\s+className=\{`border-b\s+hover:bg-gray-50\s+\$\{isExpired\s+\?\s+"bg-red-50\/30"\s+:\s+""\}\s+\$\{selectedAssignmentIds\.has\(assignment\.id\)\s+\?\s+"bg-blue-50\/50"\s+:\s+""\}\s+\$\{isLastSaved\s+\?\s+"bg-yellow-200\s+ring-2\s+ring-yellow-400\s+font-bold"\s+:\s+""\}`\}>/;
const gridRowNew = `const isDeactivated = val.is_active === false;
                                        if (!showInactive && isDeactivated) return null;

                                        return (
                                            <tr key={assignment.id} className={\`border-b hover:bg-gray-50 \${isDeactivated ? "bg-red-200" : (isExpired ? "bg-red-50/30" : "")} \${selectedAssignmentIds.has(assignment.id) ? "bg-blue-50/50" : ""} \${isLastSaved ? "bg-yellow-200 ring-2 ring-yellow-400 font-bold" : ""}\`}>`;
content = content.replace(gridRowRegex, gridRowNew);

// 3. Update ListView Row
const listRowRegex = /return\s*\(\s*<tr\s+key=\{assignment\.id\}\s+className=\{`border-b\s+last:border-0\s+h-10\s+hover:bg-gray-50\s+transition-colors\s+duration-500\s+\$\{isLastSaved\s+\?\s+"bg-yellow-200\s+ring-2\s+ring-yellow-400\s+font-bold"\s+:\s+""\}`\}>/;
const listRowNew = `const isDeactivated = val.is_active === false;
                                                                    if (!showInactive && isDeactivated) return null;

                                                                    return (
                                                                        <tr key={assignment.id} className={\`border-b last:border-0 h-10 hover:bg-gray-50 transition-colors duration-500 \${isDeactivated ? "bg-red-300 text-white hover:text-gray-900" : ""} \${isLastSaved ? "bg-yellow-200 ring-2 ring-yellow-400 font-bold" : ""}\`}>`;
content = content.replace(listRowRegex, listRowNew);

// 4. Update Edit Icons (GridView)
content = content.replace(
    /onClick=\{\(\)\s+=>\s+startEdit\(acc\.id,\s+sIdx\)\}/g,
    'onClick={() => openEditAssignModal(key, val)}'
);

// 5. Update Edit Icons (ListView)
content = content.replace(
    /onClick=\{\(\)\s+=>\s+startEdit\(acc\.id,\s+assignment\.slot_number\)\}/g,
    'onClick={() => openEditAssignModal(key, val)}'
);

// 6. Add Functions
const funcInsertPoint = 'const openMemoModal = ';
const newFuncs = `const openEditAssignModal = (key: string, data: any) => {
        setEditAssignKey(key);
        setEditAssignData({ ...data });
        setIsEditAssignModalOpen(true);
    };

    const handleUpdateEditAssign = async () => {
        if (!editAssignKey || !editAssignData) return;
        const [accountId, sIdxStr] = editAssignKey.split('_');
        const sIdx = parseInt(sIdxStr);
        await handleSaveRow(accountId, sIdx, editAssignData);
        setIsEditAssignModalOpen(false);
    };

    `;
if (!content.includes('const openEditAssignModal')) {
    content = content.replace(funcInsertPoint, newFuncs + funcInsertPoint);
}

// 7. Add History Button in header
if (!content.includes('setShowInactive(!showInactive)')) {
    content = content.replace(
        '</Button>\n                    </div>',
        `</Button>
                        <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => setShowInactive(!showInactive)} 
                            className={\`h-8 \${showInactive ? 'bg-red-50 text-red-600' : ''}\`}
                            title="비활성 회원 표시/숨기기"
                        >
                            {showInactive ? <Filter size={16} className="mr-2" /> : <PowerOff size={16} className="mr-2" />}
                            {showInactive ? '비활성 숨기기' : '비활성 보기'}
                        </Button>
                    </div>`
    );
}

// 8. Add Modal JSX at end
const lastDialogEnd = '</Dialog>\n\n            {/* Memo Modal */}';
const editModalJsx = `</Dialog>

            {/* Edit Assignment Modal */}
            <Dialog open={isEditAssignModalOpen} onOpenChange={setIsEditAssignModalOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>배정 정보 수정</DialogTitle>
                    </DialogHeader>
                    {editAssignData && (
                        <div className="grid gap-4 py-4">
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="edit-tidal-id" className="text-right">Tidal ID</Label>
                                <Input
                                    id="edit-tidal-id"
                                    className="col-span-3"
                                    value={editAssignData.tidal_id || ''}
                                    onChange={(e) => setEditAssignData({ ...editAssignData, tidal_id: e.target.value })}
                                />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="edit-tidal-pw" className="text-right">PW</Label>
                                <Input
                                    id="edit-tidal-pw"
                                    className="col-span-3"
                                    value={editAssignData.tidal_password || ''}
                                    onChange={(e) => setEditAssignData({ ...editAssignData, tidal_password: e.target.value })}
                                />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="edit-buyer-name" className="text-right">고객명</Label>
                                <Input
                                    id="edit-buyer-name"
                                    className="col-span-3"
                                    value={editAssignData.buyer_name || ''}
                                    onChange={(e) => setEditAssignData({ ...editAssignData, buyer_name: e.target.value })}
                                />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="edit-buyer-email" className="text-right">Email</Label>
                                <Input
                                    id="edit-buyer-email"
                                    className="col-span-3"
                                    value={editAssignData.buyer_email || ''}
                                    onChange={(e) => setEditAssignData({ ...editAssignData, buyer_email: e.target.value })}
                                />
                            </div>
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsEditAssignModalOpen(false)}>취소</Button>
                        <Button onClick={handleUpdateEditAssign} className="bg-blue-600 hover:bg-blue-700">저장하기</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
`;

if (!content.includes('Edit Assignment Modal')) {
    content = content.replace('            {/* Memo Modal */}', editModalJsx + '            {/* Memo Modal */}');
}

fs.writeFileSync(path, content);
console.log('Final cleanup and feature application done.');
