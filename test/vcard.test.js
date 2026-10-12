import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseContact, buildVCard, parsePhoneLine, formatPhoneLine, vcardFileName } from '../src/vcard.js';

const CARD = `
ÖRNEK YAZILIM A.Ş.
Ayşe Nur Çelik
Kıdemli Yazılım Mühendisi
GSM: +90 532 123 45 67
Tel: 0212 555 66 77  Faks: 0212 555 66 78
ayse.celik@ornek.com.tr
www.ornek.com.tr
Levent Mah. Büyükdere Cad. No: 12 Kat: 5
34330 Beşiktaş İstanbul
`;

test('parseContact extracts the main fields from a Turkish card', () => {
  const c = parseContact(CARD);
  assert.equal(c.name, 'Ayşe Nur Çelik');
  assert.equal(c.org, 'ÖRNEK YAZILIM A.Ş.');
  assert.equal(c.title, 'Kıdemli Yazılım Mühendisi');
  assert.deepEqual(c.emails, ['ayse.celik@ornek.com.tr']);
  assert.deepEqual(c.urls, ['www.ornek.com.tr']);
  assert.deepEqual(c.phones, [
    { type: 'cell', value: '+90 532 123 45 67' },
    { type: 'work', value: '0212 555 66 77' },
    { type: 'fax', value: '0212 555 66 78' },
  ]);
  assert.match(c.address, /Büyükdere Cad/);
  assert.match(c.address, /34330 Beşiktaş/);
});

test('parseContact handles English cards with unlabeled mobile numbers', () => {
  const c = parseContact('John Smith\nSales Manager\nAcme Inc.\n0532 987 65 43\njohn@acme.com');
  assert.equal(c.name, 'John Smith');
  assert.equal(c.title, 'Sales Manager');
  assert.equal(c.org, 'Acme Inc.');
  assert.deepEqual(c.phones, [{ type: 'cell', value: '0532 987 65 43' }]);
});

test('phone lines round-trip through the editable form format', () => {
  const p = { type: 'fax', value: '0212 555 66 78' };
  assert.deepEqual(parsePhoneLine(formatPhoneLine(p)), p);
  assert.deepEqual(parsePhoneLine('+90 533 000 11 22'), { type: 'cell', value: '+90 533 000 11 22' });
  assert.deepEqual(parsePhoneLine('0312 444 00 00'), { type: 'work', value: '0312 444 00 00' });
});

test('buildVCard produces a valid, escaped, folded vCard 3.0', () => {
  const vcf = buildVCard({
    name: 'Ayşe Nur Çelik',
    org: 'Örnek; Yazılım, A.Ş.',
    title: 'Mühendis',
    phones: [{ type: 'cell', value: '+90 532 123 45 67' }],
    emails: ['ayse@ornek.com'],
    urls: [],
    address: 'Büyükdere Cad. No: 12 '.repeat(5).trim(),
  });
  const lines = vcf.split('\r\n');
  assert.equal(lines[0], 'BEGIN:VCARD');
  assert.equal(lines[1], 'VERSION:3.0');
  assert.ok(lines.includes('N:Çelik;Ayşe Nur;;;'));
  assert.ok(lines.includes('FN:Ayşe Nur Çelik'));
  assert.ok(lines.includes('ORG:Örnek\\; Yazılım\\, A.Ş.'));
  assert.ok(lines.includes('TEL;TYPE=CELL,VOICE:+90 532 123 45 67'));
  assert.ok(lines.includes('EMAIL;TYPE=INTERNET:ayse@ornek.com'));
  assert.ok(vcf.endsWith('END:VCARD\r\n'));
  const enc = new TextEncoder();
  for (const l of lines) assert.ok(enc.encode(l).length <= 75, `line too long: ${l}`);
  // Unfolding restores the original address line.
  const unfolded = vcf.replace(/\r\n /g, '');
  assert.match(unfolded, /ADR;TYPE=WORK:;;(Büyükdere Cad. No: 12 ){4}Büyükdere Cad. No: 12;;;;/);
});

test('vcardFileName is filesystem safe', () => {
  assert.equal(vcardFileName({ name: 'Ayşe Nur Çelik' }), 'Ayse_Nur_Celik.vcf');
  assert.equal(vcardFileName({ name: 'Işıl Güneş-Öztürk' }), 'Isil_Gunes_Ozturk.vcf');
  assert.equal(vcardFileName({ name: 'José Müller' }), 'Jose_Muller.vcf');
  assert.equal(vcardFileName({ name: '', org: '' }), 'kisi.vcf');
});
