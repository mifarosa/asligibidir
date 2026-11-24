// Conversion between parsed contacts and the editable form, where list fields
// are plain multi-line text.
import { formatPhoneLine, parsePhoneLine } from './vcard.js';

export const EMPTY_FORM = { name: '', title: '', org: '', phones: '', emails: '', urls: '', address: '' };

const lines = (v) =>
  v
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

export function contactToForm(c) {
  return {
    name: c.name,
    title: c.title,
    org: c.org,
    phones: c.phones.map(formatPhoneLine).join('\n'),
    emails: c.emails.join('\n'),
    urls: c.urls.join('\n'),
    address: c.address,
  };
}

export function formToContact(f) {
  return {
    name: f.name.trim(),
    title: f.title.trim(),
    org: f.org.trim(),
    phones: lines(f.phones).map(parsePhoneLine),
    emails: lines(f.emails),
    urls: lines(f.urls),
    address: f.address.trim(),
  };
}
