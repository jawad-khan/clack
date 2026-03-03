import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default function globalSetup() {
  const backendDir = path.resolve(__dirname, '../../backend');
  execSync('npx tsx prisma/seed.ts', { cwd: backendDir, stdio: 'inherit' });
}
