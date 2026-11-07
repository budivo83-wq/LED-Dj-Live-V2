import fs from 'fs';
import path from 'path';

const root = process.cwd();
const interesting = ['public', 'src/server', 'src/output', 'scripts', 'docs'];
const rows = [];
function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', 'archive', '.git'].includes(entry.name)) continue;
      walk(full);
    } else {
      const stat = fs.statSync(full);
      if (/\.(js|html|css|json|md)$/i.test(entry.name)) rows.push({ file: path.relative(root, full), bytes: stat.size });
    }
  }
}
interesting.forEach(walk);
rows.sort((a, b) => b.bytes - a.bytes);
const total = rows.reduce((sum, r) => sum + r.bytes, 0);
console.log(`PROJECT AUDIT · ${rows.length} text/code files · ${(total/1024/1024).toFixed(2)} MiB`);
console.log('\nLargest files:');
for (const r of rows.slice(0, 25)) console.log(`${String(r.bytes).padStart(8)}  ${r.file}`);
