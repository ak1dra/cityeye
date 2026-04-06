import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const source = path.join(root, '.env.example');
const target = path.join(root, '.env.local');

if (!fs.existsSync(source)) {
  console.error(`Source file not found: ${source}`);
  process.exit(1);
}

if (fs.existsSync(target)) {
  console.log('.env.local already exists, skipped.');
  process.exit(0);
}

fs.mkdirSync(path.dirname(target), { recursive: true });
fs.copyFileSync(source, target);
console.log('Created .env.local from .env.example');
