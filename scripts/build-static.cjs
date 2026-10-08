const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const output = path.join(root, 'dist');
const entries = ['index.html', 'controller.html', 'README.md', 'assets', 'css', 'js'];

fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(output, { recursive: true });

for (const entry of entries) {
  fs.cpSync(path.join(root, entry), path.join(output, entry), { recursive: true });
}

console.log(`Sitio estático generado en ${output}`);
