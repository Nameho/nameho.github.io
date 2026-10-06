#!/usr/bin/env node
// Petit serveur d'aperçu local, sans dépendance : node scripts/serve.mjs
// Puis ouvrir http://localhost:8080 (accessible uniquement depuis ce PC).

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

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
  '.xml': 'application/xml; charset=utf-8',
  '.bin': 'application/octet-stream',
};

// Comme GitHub Pages : textes compressés en gzip, revalidation à chaque visite
const COMPRESSIBLE = new Set(['.html', '.css', '.js', '.json', '.svg', '.txt', '.xml']);

async function send(res, status, file, acceptsGzip = false) {
  let body = await readFile(file);
  const headers = {
    'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream',
    'Cache-Control': 'no-cache',
    'X-Content-Type-Options': 'nosniff',
  };
  if (acceptsGzip && COMPRESSIBLE.has(extname(file))) {
    body = gzipSync(body);
    headers['Content-Encoding'] = 'gzip';
    headers.Vary = 'Accept-Encoding';
  }
  res.writeHead(status, headers);
  res.end(body);
}

createServer(async (req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405).end();
    return;
  }
  const gzip = /\bgzip\b/.test(req.headers['accept-encoding'] ?? '');
  try {
    let path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (path.endsWith('/')) path += 'index.html';
    const file = resolve(ROOT, '.' + path);
    if (!file.startsWith(ROOT + sep)) throw new Error('hors du dossier site');
    await send(res, 200, file, gzip);
  } catch {
    await send(res, 404, resolve(ROOT, '404.html'), gzip).catch(() => res.writeHead(404).end());
  }
}).listen(PORT, '127.0.0.1', () => {
  console.log(`Aperçu du portfolio : http://localhost:${PORT}  (Ctrl+C pour arrêter)`);
});
