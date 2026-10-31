import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Fall back to the values committed in .env.example for any VITE_* variable
// that isn't already set (e.g. in Netlify environment variables or a local .env).
const examplePath = path.join(path.dirname(fileURLToPath(import.meta.url)), '.env.example');
if (fs.existsSync(examplePath)) {
  for (const line of fs.readFileSync(examplePath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*(VITE_[A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!match) continue;
    let value = match[2];
    if (/^(["']).*\1$/.test(value)) value = value.slice(1, -1).trim();
    if (value && !process.env[match[1]]) process.env[match[1]] = value;
  }
}

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: true,
  },
  preview: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: true,
  },
});
