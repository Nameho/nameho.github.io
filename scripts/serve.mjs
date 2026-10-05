#!/usr/bin/env node
// Petit serveur d'aperçu local, sans dépendance : node scripts/serve.mjs
// Puis ouvrir http://localhost:8080 (accessible uniquement depuis ce PC).

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('../site/', import.meta.url)));
const PORT = Number(process.env.PORT) || 8080;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

async function send(res, status, file) {
  const body = await readFile(file);
  res.writeHead(status, {
    'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(body);
}

createServer(async (req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405).end();
    return;
  }
  try {
    let path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (path.endsWith('/')) path += 'index.html';
    const file = resolve(ROOT, '.' + path);
    if (!file.startsWith(ROOT + sep)) throw new Error('hors du dossier site');
    await send(res, 200, file);
  } catch {
    await send(res, 404, resolve(ROOT, '404.html')).catch(() => res.writeHead(404).end());
  }
}).listen(PORT, '127.0.0.1', () => {
  console.log(`Aperçu du portfolio : http://localhost:${PORT}  (Ctrl+C pour arrêter)`);
});
