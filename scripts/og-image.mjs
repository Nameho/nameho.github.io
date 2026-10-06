#!/usr/bin/env node
// Régénère l'image d'aperçu des liens (1200×630) à partir de scripts/og-image.html,
// avec Microsoft Edge en mode sans fenêtre : node scripts/og-image.mjs
// Résultat : site/assets/og-image.png (Discord, LinkedIn, WhatsApp… la mettent en cache :
// après un changement, partager le lien avec ?v=2 pour voir la nouvelle).

import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const edge = process.env.EDGE_PATH ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const out = join(root, 'site', 'assets', 'og-image.png');
const profile = mkdtempSync(join(tmpdir(), 'og-edge-'));

const run = spawnSync(edge, [
  '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run',
  `--user-data-dir=${profile}`, '--window-size=1200,630', '--virtual-time-budget=3000',
  `--screenshot=${out}`, pathToFileURL(join(root, 'scripts', 'og-image.html')).href,
], { stdio: 'inherit' });
rmSync(profile, { recursive: true, force: true });

if (run.status !== 0) {
  console.error('Échec : Edge introuvable ou arrêté (variable EDGE_PATH pour un autre chemin).');
  process.exit(1);
}
console.log(`Image générée : ${out} (${Math.round(statSync(out).size / 1024)} Ko)`);
