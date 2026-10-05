// Coordonnées encodées (jamais en clair dans le code) : décodées seulement à la demande
// d'un visiteur (mini-jeu de soudure, mode express…). Pour les changer : voir TUTORIEL-GITHUB.md.

import { copyText } from './util.js';
import { sfx } from './audio.js';
import { toast } from './hud.js';

const KEY = 'pcb-17-solder';
const ENC = { email: 'EQ8HVVhEAwcdGQAAHhwGUxpxUEASBgBKBh0d', phone: 'W1BRGgkGFUJaXlxX' };
const decode = (b64) => [...atob(b64)].map((c, i) => String.fromCharCode(c.charCodeAt(0) ^ KEY.charCodeAt(i % KEY.length))).join('');

export function getContact() {
  const email = decode(ENC.email);
  const phone = decode(ENC.phone);
  const phoneTxt = phone.replace(/^\+33/, '0').replace(/(\d{2})(?=\d)/g, '$1 ');
  return { email, phone, phoneTxt };
}

/** Copie l'e-mail ou le téléphone, avec message de confirmation. */
export async function copyContact(kind, source = null) {
  const c = getContact();
  const ok = await copyText(kind === 'email' ? c.email : c.phoneTxt);
  sfx(ok ? 'ok' : 'buzz');
  toast(ok
    ? (kind === 'email' ? 'Adresse e-mail copiée dans le presse-papiers ✔' : 'Numéro de téléphone copié ✔')
    : 'Copie impossible : sélectionnez le texte à la main');
  if (ok && source) {
    source.classList.add('is-copied');
    setTimeout(() => source.classList.remove('is-copied'), 1800);
  }
  return ok;
}
