const fs = require('fs');
const path = 'c:/Users/전성현/dalbus/src/app/(protected)/admin/tidal/page.tsx';
let content = fs.readFileSync(path, 'utf8');

// GridView row replacement
const gridRowTarget = /<tr\s+key=\{assignment\.id\}\s+className=\{`border-b\s+hover:bg-gray-50\s+\$\{isExpired\s+\?\s+'bg-red-50\/30'\s+:\s+''\}\s+\$\{selectedAssignmentIds\.has\(assignment\.id\)\s+\?\s+'bg-blue-50\/50'\s+:\s+''\}\s+\$\{isLastSaved\s+\?\s+'bg-yellow-100\s+transition-all\s+duration-500'\s+:\s+''\}`\}/;
const gridRowNew = '<tr key={assignment.id} className={`border-b hover:bg-gray-50 ${isExpired ? "bg-red-50/30" : ""} ${selectedAssignmentIds.has(assignment.id) ? "bg-blue-50/50" : ""} ${isLastSaved ? "bg-yellow-200 ring-2 ring-yellow-400 font-bold" : ""}`}>';
content = content.replace(gridRowTarget, gridRowNew);

// ListView row replacement
const listRowTarget = /<tr\s+key=\{assignment\.id\}\s+className=\{`border-b\s+last:border-0\s+h-10\s+hover:bg-gray-50\s+\$\{isLastSaved\s+\?\s+'bg-yellow-100\s+transition-all\s+duration-500'\s+:\s+''\}`\}/;
const listRowNew = '<tr key={assignment.id} className={`border-b last:border-0 h-10 hover:bg-gray-50 ${isLastSaved ? "bg-yellow-200 ring-2 ring-yellow-400 font-bold" : ""}`}>';
content = content.replace(listRowTarget, listRowNew);

fs.writeFileSync(path, content);
console.log('Improved highlights (Final version)');
