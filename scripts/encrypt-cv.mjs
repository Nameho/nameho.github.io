#!/usr/bin/env node
// Chiffre le CV pour le site : node scripts/encrypt-cv.mjs
//
// - lit prive/CV-Alexis-Trudelle.pdf (dossier exclu de Git : le PDF en clair n'est jamais publié) ;
// - écrit site/assets/cv/cv.bin (AES-256-GCM, illisible pour Google et les robots) ;
// - écrit site/assets/js/cv-key.js (la clé, utilisée par le navigateur après le test anti-robot).
//
// Limite assumée : la clé est dans le code du site, donc une personne déterminée pourrait
// déchiffrer le fichier. Le but est de bloquer l'indexation et l'aspiration automatique.
// À relancer à chaque nouvelle version du CV (une nouvelle clé est générée à chaque fois).

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { randomBytes, createCipheriv } from 'node:crypto';

const SOURCE = new URL('../prive/CV-Alexis-Trudelle.pdf', import.meta.url);
const OUT_DIR = new URL('../site/assets/cv/', import.meta.url);
const OUT_FILE = new URL('cv.bin', OUT_DIR);
const KEY_FILE = new URL('../site/assets/js/cv-key.js', import.meta.url);

const pdf = await readFile(SOURCE).catch(() => {
  console.error('CV introuvable : place ton PDF dans prive/CV-Alexis-Trudelle.pdf');
  process.exit(1);
});
if (pdf.subarray(0, 5).toString('latin1') !== '%PDF-') {
  console.error("Ce fichier n'est pas un PDF.");
  process.exit(1);
}

const key = randomBytes(32);
const iv = randomBytes(12);
const cipher = createCipheriv('aes-256-gcm', key, iv);
const body = Buffer.concat([cipher.update(pdf), cipher.final(), cipher.getAuthTag()]);

await mkdir(OUT_DIR, { recursive: true });
await writeFile(OUT_FILE, Buffer.concat([iv, body]));
await writeFile(
  KEY_FILE,
  `// Généré par scripts/encrypt-cv.mjs : ne pas modifier à la main.\nexport const CV_KEY = '${key.toString('base64')}';\nexport const CV_NAME = 'CV-Alexis-Trudelle-reparateur-electronique.pdf';\n`,
);
console.log(`CV chiffré : ${pdf.length} octets → site/assets/cv/cv.bin`);
