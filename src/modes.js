// Scan modes: what the user is photographing decides the default filter and
// whether the page is read as a business card.
export const MODES = [
  {
    key: 'document',
    label: 'Belge',
    prefix: 'belge',
    defaultFilter: 'gray',
    hint: 'Gölge ve ışık farklarını giderir, metni yüksek kontrastlı siyah-beyaz yapar.',
  },
  {
    key: 'whiteboard',
    label: 'Beyaz tahta',
    prefix: 'tahta',
    defaultFilter: 'color',
    hint: 'Parlamayı ve gölgeyi bastırır, tahtayı beyazlatır, kalem renklerini belirginleştirir.',
  },
  {
    key: 'card',
    label: 'Kartvizit',
    prefix: 'kartvizit',
    defaultFilter: 'gray',
    readsContact: true,
    hint: 'Kartviziti okur; ad, telefon ve e-postayı ayırıp kişi kartı (.vcf) olarak dışa aktarır.',
  },
];

export const modeByKey = (key) => MODES.find((m) => m.key === key) ?? MODES[0];
