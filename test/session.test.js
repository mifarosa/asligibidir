import { test } from 'node:test';
import assert from 'node:assert/strict';
import { currentPage, initialSession, newPage, sessionReducer } from '../src/session.js';
import { contactToForm, formToContact } from '../src/contact/form.js';

const quad = [
  { x: 0, y: 0 },
  { x: 9, y: 0 },
  { x: 9, y: 9 },
  { x: 0, y: 9 },
];
const run = (actions, s = initialSession) => actions.reduce(sessionReducer, s);

test('adding a page selects it and opens the crop editor', () => {
  const s = run([{ type: 'addPage', page: newPage({}, quad, true) }]);
  assert.equal(s.current, 0);
  assert.equal(s.cropping, true);
  assert.deepEqual(currentPage(s).quad, quad);
});

test('edits apply to the current page only', () => {
  const s = run([
    { type: 'addPage', page: newPage({}, quad, true) },
    { type: 'finishCrop' },
    { type: 'addPage', page: newPage({}, quad, false) },
    { type: 'rotate', turns: -1 },
    { type: 'setSharpen', level: 2 },
    { type: 'setFilter', filter: 'bw' },
    { type: 'moveCorner', index: 2, point: { x: 5, y: 6 } },
  ]);
  const [first, second] = s.pages;
  assert.deepEqual([first.rotation, first.sharpen, first.filter], [0, 0, null]);
  assert.deepEqual([second.rotation, second.sharpen, second.filter], [3, 2, 'bw']);
  assert.deepEqual(second.quad[2], { x: 5, y: 6 });
  assert.deepEqual(first.quad[2], quad[2]);
});

test('rotation wraps around', () => {
  const s = run([
    { type: 'addPage', page: newPage({}, quad, true) },
    ...Array.from({ length: 5 }, () => ({ type: 'rotate', turns: 1 })),
  ]);
  assert.equal(currentPage(s).rotation, 1);
});

test('removing pages keeps a valid selection', () => {
  let s = run([0, 1, 2].map(() => ({ type: 'addPage', page: newPage({}, quad, true) })));
  assert.equal(s.current, 2);
  s = sessionReducer(s, { type: 'removePage', index: 2 });
  assert.equal(s.current, 1);
  s = sessionReducer(s, { type: 'removePage', index: 0 });
  assert.deepEqual([s.pages.length, s.current], [1, 0]);
  s = sessionReducer(s, { type: 'removePage', index: 0 });
  assert.equal(s, initialSession);
});

test('contact form round-trips', () => {
  const contact = {
    name: 'Ayşe Nur Çelik',
    title: 'Mühendis',
    org: 'Örnek A.Ş.',
    phones: [
      { type: 'cell', value: '+90 532 123 45 67' },
      { type: 'fax', value: '0212 555 66 78' },
    ],
    emails: ['ayse@ornek.com'],
    urls: ['www.ornek.com'],
    address: 'Büyükdere Cad. No: 12',
  };
  assert.deepEqual(formToContact(contactToForm(contact)), contact);
});

test('savedAs survives navigation but not edits', () => {
  const opened = sessionReducer(initialSession, {
    type: 'openScan',
    id: 'abc',
    pages: [newPage({}, quad, false), newPage({}, quad, false)],
  });
  assert.deepEqual([opened.current, opened.cropping, opened.savedAs], [0, false, 'abc']);
  assert.equal(sessionReducer(opened, { type: 'selectPage', index: 1 }).savedAs, 'abc');
  assert.equal(sessionReducer(opened, { type: 'rotate', turns: 1 }).savedAs, null);
  assert.equal(sessionReducer(opened, { type: 'removePage', index: 1 }).savedAs, null);
  const resaved = sessionReducer(sessionReducer(opened, { type: 'setSharpen', level: 1 }), {
    type: 'markSaved',
    id: 'def',
  });
  assert.equal(resaved.savedAs, 'def');
});

test('addPages appends ready pages without opening the crop editor', () => {
  const s = run([
    { type: 'addPage', page: newPage({}, quad, true) },
    { type: 'finishCrop' },
    { type: 'addPages', pages: [newPage({}, quad, true), newPage({}, quad, true)] },
  ]);
  assert.deepEqual([s.pages.length, s.current, s.cropping], [3, 1, false]);
});
