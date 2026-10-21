/**
 * کپی خروجی Vite (`dist/`) به پوشهٔ بستهٔ Electron (`desktop/web/`)
 * اجرا: node desktop/prepare.mjs
 */
import { cp, rm, mkdir, access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const source = path.resolve(here, '..', 'dist');
const target = path.resolve(here, 'web');

try {
  await access(path.join(source, 'index.html'), constants.R_OK);
} catch {
  console.error('✖ خروجی Vite پیدا نشد. اول `npm run build:app` را اجرا کنید.');
  process.exit(1);
}

await rm(target, { recursive: true, force: true });
await mkdir(target, { recursive: true });
await cp(source, target, { recursive: true });
console.log(`✔ خروجی وب در desktop/web کپی شد (${source} → ${target})`);
