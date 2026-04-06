import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const nextDir = path.join(root, '.next');

if (fs.existsSync(nextDir)) {
  fs.rmSync(nextDir, { recursive: true, force: true });
  console.log('Removed .next build cache.');
} else {
  console.log('.next cache not found, nothing to clean.');
}

console.log('Recovery flow: npm run build && npm run start');

