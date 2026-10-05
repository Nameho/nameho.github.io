#!/usr/bin/env node
// Veille technologique : récupère les flux RSS/Atom listés dans veille-sources.json
// et écrit site/data/veille.json (lu ensuite par la page).
//
// Sécurité : aucune dépendance npm (rien à pirater dans la chaîne d'approvisionnement),
// HTTPS obligatoire, taille et durée des téléchargements limitées, texte nettoyé
// (balises, caractères de contrôle, inversions bidi) et liens vérifiés.
// La page affiche ensuite ces données en texte brut uniquement (jamais innerHTML).

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const SOURCES_FILE = new URL('./veille-sources.json', import.meta.url);
const OUTPUT_DIR = new URL('../site/data/', import.meta.url);
const OUTPUT_FILE = new URL('veille.json', OUTPUT_DIR);

const MAX_BYTES = 3 * 1024 * 1024;
const TIMEOUT_MS = 15_000;
const MAX_ITEMS = 40;
const MAX_TITLE = 160;
const MAX_EXCERPT = 240;
const UA = 'Mozilla/5.0 (compatible; VeillePortfolio/1.0; +https://nameho.github.io)';

const ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', hellip: '…',
  rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', laquo: '«', raquo: '»',
  ndash: '–', mdash: '—', bull: '•', middot: '·', deg: '°', times: '×',
  euro: '€', copy: '©', reg: '®', trade: '™', oelig: 'œ', OElig: 'Œ',
  eacute: 'é', egrave: 'è', ecirc: 'ê', euml: 'ë', agrave: 'à', acirc: 'â',
  ccedil: 'ç', icirc: 'î', iuml: 'ï', ocirc: 'ô', ugrave: 'ù', ucirc: 'û',
  uuml: 'ü', Eacute: 'É', Egrave: 'È', Agrave: 'À', Ccedil: 'Ç',
};

function decodeEntities(text) {
  return text.replace(/&(#x[0-9a-f]{1,6}|#[0-9]{1,7}|[a-z]{2,8});/gi, (match, code) => {
    if (code[0] === '#') {
      const n = code[1] === 'x' || code[1] === 'X' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      const valid = n > 31 && n !== 127 && n <= 0x10ffff && !(n >= 0xd800 && n <= 0xdfff);
      return valid ? String.fromCodePoint(n) : ' ';
    }
    return ENTITIES[code] ?? match;
  });
}

function truncate(text, max) {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const space = cut.lastIndexOf(' ');
  return (space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,;:.–-]+$/, '') + '…';
}

function cleanText(raw, max) {
  let s = raw.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
  s = decodeEntities(s); // le HTML est souvent encodé dans le XML
  s = s.replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]*>/g, ' ');
  s = decodeEntities(s);
  s = s
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F​-‏‪-‮⁦-⁩]/g, '')
    .replace(/The post .{1,300}? appeared first on .{1,120}?\.?$/i, '')
    .replace(/L[’']article .{1,300}? est apparu en premier sur .{1,120}?\.?$/i, '')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return truncate(s, max);
}

function safeUrl(raw, base) {
  try {
    const url = new URL(decodeEntities(raw.replace(/<!\[CDATA\[|\]\]>/g, '').trim()), base);
    if (url.protocol === 'http:') url.protocol = 'https:';
    if (url.protocol !== 'https:' || url.username || url.password) return null;
    for (const key of [...url.searchParams.keys()]) {
      if (/^(utm_|mc_)|^(fbclid|gclid)$/i.test(key)) url.searchParams.delete(key);
    }
    return url.href.length <= 600 ? url.href : null;
  } catch {
    return null;
  }
}

function firstTag(xml, names) {
  for (const name of names) {
    const m = new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)</${name}>`, 'i').exec(xml);
    if (m && m[1].trim()) return m[1];
  }
  return '';
}

function attr(tag, name) {
  const m = new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i').exec(tag);
  return m ? (m[1] ?? m[2]) : '';
}

function atomLink(xml) {
  let fallback = '';
  for (const tag of xml.match(/<link\b[^>]*>/gi) ?? []) {
    const href = attr(tag, 'href');
    if (!href) continue;
    const rel = attr(tag, 'rel');
    if (!rel || rel === 'alternate') return href;
    fallback ||= href;
  }
  return fallback;
}

function parseDate(raw) {
  const d = new Date(cleanText(raw, 80));
  if (Number.isNaN(d.getTime()) || d.getTime() > Date.now() + 86_400_000) return null;
  return d.toISOString();
}

function parseFeed(xml, source) {
  const items = [];
  for (const m of xml.matchAll(/<(item|entry)\b[^>]*>([\s\S]*?)<\/\1>/gi)) {
    const body = m[2];
    const title = cleanText(firstTag(body, ['title']), MAX_TITLE);
    const linkText = firstTag(body, ['link']);
    const url = safeUrl(/^\s*(<!\[CDATA\[)?\s*https?:/i.test(linkText) ? linkText : atomLink(body), source.url);
    if (!title || !url) continue;
    items.push({
      id: createHash('sha1').update(url).digest('hex').slice(0, 12),
      source: source.id,
      title,
      url,
      date: parseDate(firstTag(body, ['pubDate', 'published', 'updated', 'dc:date'])),
      excerpt: cleanText(firstTag(body, ['description', 'summary', 'media:description', 'content:encoded', 'content']), MAX_EXCERPT),
    });
  }
  items.sort(byDateDesc);
  return items.slice(0, source.max);
}

function byDateDesc(a, b) {
  return (b.date ?? '').localeCompare(a.date ?? '');
}

async function fetchText(url) {
  const res = await fetch(url, {
    redirect: 'follow',
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: {
      'User-Agent': UA,
      Accept: 'application/rss+xml, application/atom+xml, application/xml;q=0.9, text/xml;q=0.8',
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  if (new URL(res.url).protocol !== 'https:') throw new Error('redirection hors HTTPS');

  const chunks = [];
  let size = 0;
  for await (const chunk of res.body) {
    size += chunk.byteLength;
    if (size > MAX_BYTES) throw new Error('flux trop volumineux');
    chunks.push(chunk);
  }
  const bytes = Buffer.concat(chunks);
  const head = bytes.subarray(0, 200).toString('latin1');
  const encoding = /encoding=["']([\w-]+)["']/i.exec(head)?.[1] ?? 'utf-8';
  try {
    return new TextDecoder(encoding).decode(bytes);
  } catch {
    return new TextDecoder('utf-8').decode(bytes);
  }
}

function checkSources(list) {
  if (!Array.isArray(list) || list.length === 0) throw new Error('veille-sources.json : liste vide');
  for (const s of list) {
    const ok =
      /^[a-z0-9-]{2,30}$/.test(s.id) &&
      typeof s.nom === 'string' && s.nom.length <= 40 &&
      safeUrl(s.url) === s.url.replace(/^http:/, 'https:') &&
      safeUrl(s.site) !== null &&
      Number.isInteger(s.max) && s.max >= 1 && s.max <= 10;
    if (!ok) throw new Error(`veille-sources.json : source invalide (${JSON.stringify(s.id)})`);
  }
  return list;
}

async function main() {
  const sources = checkSources(JSON.parse(await readFile(SOURCES_FILE, 'utf8')));

  let previous = null;
  try {
    previous = JSON.parse(await readFile(OUTPUT_FILE, 'utf8'));
  } catch {
    // premier lancement : pas d'ancien fichier
  }

  const results = await Promise.allSettled(sources.map(async (s) => parseFeed(await fetchText(s.url), s)));

  const items = [];
  results.forEach((r, i) => {
    const s = sources[i];
    if (r.status === 'fulfilled' && r.value.length > 0) {
      items.push(...r.value);
      console.log(`✔ ${s.nom} : ${r.value.length} articles`);
    } else {
      // Panne passagère d'une source : on garde ses anciens articles plutôt qu'un trou.
      const kept = previous?.items?.filter((it) => it.source === s.id) ?? [];
      items.push(...kept);
      const why = r.status === 'rejected' ? r.reason?.message : 'aucun article lisible';
      console.log(`::warning::${s.nom} indisponible (${why}) — ${kept.length} anciens articles conservés`);
    }
  });

  const seen = new Set();
  const unique = items
    .filter((it) => !seen.has(it.url) && seen.add(it.url))
    .sort(byDateDesc)
    .slice(0, MAX_ITEMS);

  const sourcesOut = sources.map(({ id, nom, site, theme, langue }) => ({ id, nom, site, theme, langue }));

  if (
    previous &&
    JSON.stringify(previous.items) === JSON.stringify(unique) &&
    JSON.stringify(previous.sources) === JSON.stringify(sourcesOut)
  ) {
    console.log('Aucun nouvel article : fichier inchangé.');
    return;
  }

  await mkdir(OUTPUT_DIR, { recursive: true });
  const output = { updatedAt: new Date().toISOString(), sources: sourcesOut, items: unique };
  await writeFile(OUTPUT_FILE, JSON.stringify(output, null, 2) + '\n', 'utf8');
  console.log(`veille.json écrit : ${unique.length} articles.`);
}

main().catch((err) => {
  console.error(`::error::${err.message}`);
  process.exit(1);
});
