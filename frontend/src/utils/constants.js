// Yanlış cevaptan sonra bir soru için üretilebilecek en fazla benzer soru sayısı.
// (Backend'deki MAX_ADAPTIVE_ATTEMPTS ile aynı olmalıdır.)
export const MAX_ADAPTIVE = 5;

export const LEVEL_LABELS = { junior: 'Junior', mid: 'Mid-Level', senior: 'Senior' };

const ORDINALS = ['Birinci', 'İkinci', 'Üçüncü', 'Dördüncü', 'Beşinci', 'Altıncı', 'Yedinci', 'Sekizinci', 'Dokuzuncu', 'Onuncu'];
/** Sesli simülasyonda soru numarasını okumak için: 1 -> "Birinci soru". */
export const ordinalQuestion = (n) => `${ORDINALS[n - 1] || `${n}.`} soru`;
