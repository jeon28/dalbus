const fs = require('fs');
const path = 'c:/Users/전성현/dalbus/src/app/(protected)/admin/tidal/page.tsx';
let lines = fs.readFileSync(path, 'utf8').split('\n');

// 2289: </Dialog> (0-indexed 2288)
if (lines[2288].trim() === '</Dialog>' && lines[2287].trim() === '</Dialog>') {
    lines.splice(2288, 1);
    fs.writeFileSync(path, lines.join('\n'));
    console.log('Fixed extra </Dialog> tag.');
} else {
    console.log('Mismatch at line 2289:', lines[2288]);
}
