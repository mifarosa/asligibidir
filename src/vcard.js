// Business card parsing (OCR text -> contact fields) and vCard 3.0 export.

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const URL_RE = /\b(?:https?:\/\/|www\.)[^\s,;]+/gi;
const PHONE_RE = /(?:\+|\b00)?\(?\d[\d\s().\-/]{5,}\d/g;

const ORG_RE = /\b(?:a\.?\s?ş\.?|ltd\.?|şti\.?|inc\.?|llc|gmbh|corp\.?|holding|limited|şirketi|company|co\.)(?=\s|$|[,.])/i;
const TITLE_RE =
  /\b(?:müdür\w*|yönetici\w*|direktör\w*|mühendis\w*|uzman\w*|danışman\w*|başkan\w*|sorumlu\w*|temsilci\w*|avukat|doktor|dr\.|ceo|cto|cfo|coo|founder|kurucu\w*|ortak|manager|director|engineer|developer|designer|consultant|specialist|president|officer|head|lead|sales|satış)\b/i;
const ADDRESS_RE = /\b(?:mah\.?|mahalle\w*|cad\.?|cadde\w*|sok\.?|sokak|bulvar\w*|blv\.?|no\s*[:.]|kat\s*[:.]?|daire|plaza|street|st\.|avenue|ave\.|road|suite|floor|\d{5}\s+\p{L}+)/iu;
const FAX_LABEL_RE = /\b(?:faks|fax|f\s*[:.])/i;
const CELL_LABEL_RE = /\b(?:gsm|cep|mobil\w*|mobile|cell|m\s*[:.])/i;

export const PHONE_TYPES = { cell: 'Cep', work: 'İş', fax: 'Faks' };

function digitsOf(s) {
  return s.replace(/\D/g, '');
}

// Turkish mobile numbers start with 5xx after the country/trunk prefix.
function isTurkishMobile(value) {
  const d = digitsOf(value);
  return /^(?:0090|90|0)?5\d{9}$/.test(d);
}

function cleanPhone(raw) {
  return raw.replace(/[^\d+()\s-]/g, ' ').replace(/\s+/g, ' ').trim();
}

function classifyPhone(line, value) {
  if (FAX_LABEL_RE.test(line)) return 'fax';
  if (CELL_LABEL_RE.test(line) || isTurkishMobile(value)) return 'cell';
  return 'work';
}

function isNameCandidate(line) {
  if (/\d|@/.test(line)) return false;
  if (ORG_RE.test(line) || TITLE_RE.test(line) || ADDRESS_RE.test(line)) return false;
  const words = line.split(/\s+/).filter(Boolean);
  if (words.length < 2 || words.length > 4) return false;
  return words.every((w) => /^\p{Lu}[\p{L}.'’-]*$/u.test(w));
}

// Extract contact fields from raw OCR output. Heuristic by nature: the UI lets
// the user correct every field before exporting.
export function parseContact(text) {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  const contact = { name: '', title: '', org: '', phones: [], emails: [], urls: [], address: '' };
  const rest = [];

  for (const line of lines) {
    let consumed = false;

    for (const m of line.match(EMAIL_RE) ?? []) {
      const email = m.toLowerCase();
      if (!contact.emails.includes(email)) contact.emails.push(email);
      consumed = true;
    }
    const withoutEmails = line.replace(EMAIL_RE, ' ');

    for (const m of withoutEmails.match(URL_RE) ?? []) {
      const url = m.replace(/[.)]+$/, '');
      if (!contact.urls.includes(url)) contact.urls.push(url);
      consumed = true;
    }
    const withoutUrls = withoutEmails.replace(URL_RE, ' ');

    // A line may hold several numbers ("Tel: ... Faks: ..."), so each one is
    // labelled by the text between it and the previous number.
    let prevEnd = 0;
    for (const m of withoutUrls.matchAll(PHONE_RE)) {
      const label = withoutUrls.slice(prevEnd, m.index);
      prevEnd = m.index + m[0].length;
      const d = digitsOf(m[0]);
      if (d.length < 7 || d.length > 15) continue;
      const value = cleanPhone(m[0]);
      if (contact.phones.some((p) => digitsOf(p.value) === d)) continue;
      contact.phones.push({ type: classifyPhone(label, value), value });
      consumed = true;
    }

    if (!consumed) rest.push(line);
  }

  const addressLines = [];
  for (const line of rest) {
    if (!contact.name && isNameCandidate(line)) contact.name = line;
    else if (!contact.org && ORG_RE.test(line)) contact.org = line;
    else if (!contact.title && TITLE_RE.test(line)) contact.title = line;
    else if (ADDRESS_RE.test(line)) addressLines.push(line);
  }
  contact.address = addressLines.join(', ');
  return contact;
}

// Phones are edited as "Label: number" lines in the UI; this reverses that.
export function formatPhoneLine(phone) {
  return `${PHONE_TYPES[phone.type] ?? PHONE_TYPES.work}: ${phone.value}`;
}

export function parsePhoneLine(line) {
  const m = line.match(/^\s*([^:\d+]+):\s*(.+)$/);
  if (!m) {
    const value = line.trim();
    return { type: isTurkishMobile(value) ? 'cell' : 'work', value };
  }
  const label = m[1].trim().toLocaleLowerCase('tr');
  const type =
    Object.keys(PHONE_TYPES).find((k) => PHONE_TYPES[k].toLocaleLowerCase('tr') === label) ??
    classifyPhone(m[1] + ':', m[2]);
  return { type, value: m[2].trim() };
}

function escapeValue(v) {
  return String(v)
    .replace(/\\/g, '\\\\')
    .replace(/\r?\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

// RFC 6350/2426 line folding: max 75 octets per line, never splitting a
// multi-byte UTF-8 character.
function foldLine(line) {
  const enc = new TextEncoder();
  if (enc.encode(line).length <= 75) return line;
  const parts = [];
  let current = '';
  let bytes = 0;
  let limit = 75;
  for (const ch of line) {
    const n = enc.encode(ch).length;
    if (bytes + n > limit) {
      parts.push(current);
      current = '';
      bytes = 0;
      limit = 74; // continuation lines start with a space
    }
    current += ch;
    bytes += n;
  }
  parts.push(current);
  return parts.join('\r\n ');
}

function splitName(fullName) {
  const words = fullName.trim().split(/\s+/).filter(Boolean);
  if (words.length < 2) return { family: '', given: words.join(' ') };
  return { family: words[words.length - 1], given: words.slice(0, -1).join(' ') };
}

export function buildVCard(contact) {
  const name = (contact.name ?? '').trim();
  const fn = name || contact.org || contact.emails?.[0] || 'Kişi';
  const { family, given } = splitName(name);
  const lines = ['BEGIN:VCARD', 'VERSION:3.0'];
  lines.push(`N:${escapeValue(family)};${escapeValue(given)};;;`);
  lines.push(`FN:${escapeValue(fn)}`);
  if (contact.org) lines.push(`ORG:${escapeValue(contact.org)}`);
  if (contact.title) lines.push(`TITLE:${escapeValue(contact.title)}`);
  for (const p of contact.phones ?? []) {
    if (!p.value) continue;
    const type = p.type === 'cell' ? 'CELL,VOICE' : p.type === 'fax' ? 'WORK,FAX' : 'WORK,VOICE';
    lines.push(`TEL;TYPE=${type}:${escapeValue(p.value)}`);
  }
  for (const e of contact.emails ?? []) if (e) lines.push(`EMAIL;TYPE=INTERNET:${escapeValue(e)}`);
  for (const u of contact.urls ?? []) if (u) lines.push(`URL:${escapeValue(u)}`);
  if (contact.address) lines.push(`ADR;TYPE=WORK:;;${escapeValue(contact.address)};;;;`);
  lines.push('END:VCARD');
  return lines.map(foldLine).join('\r\n') + '\r\n';
}

const ASCII_MAP = { ı: 'i', İ: 'I', ş: 's', Ş: 'S', ğ: 'g', Ğ: 'G', ç: 'c', Ç: 'C', ö: 'o', Ö: 'O', ü: 'u', Ü: 'U' };

// ASCII-only names: some browsers ignore a non-ASCII `download` attribute.
export function vcardFileName(contact) {
  const base = (contact.name || contact.org || 'kisi')
    .trim()
    .replace(/[ıİşŞğĞçÇöÖüÜ]/g, (ch) => ASCII_MAP[ch])
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return `${base || 'kisi'}.vcf`;
}
