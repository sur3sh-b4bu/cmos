/**
 * English (ITRANS / Phonetic QWERTY) to Hindi Unicode Converter
 * Converts English phonetic words (e.g. "namaste", "prarthana", "yeshu", "dhanyavad")
 * into Hindi Devanagari script (e.g. "नमस्ते", "प्रार्थना", "यीशु", "धन्यवाद").
 */

const VOWEL_INITIAL: Record<string, string> = {
  a: 'अ',
  aa: 'आ',
  A: 'आ',
  i: 'इ',
  ee: 'ई',
  I: 'ई',
  u: 'உ', // safety
  u_hi: 'उ',
  oo: 'ऊ',
  U: 'ऊ',
  ri: 'ऋ',
  R: 'ऋ',
  e: 'ए',
  E: 'ए',
  ai: 'ऐ',
  o: 'ओ',
  O: 'ओ',
  au: 'औ',
  OU: 'औ',
};

const VOWELS_HI: Record<string, string> = {
  a: 'अ',
  aa: 'आ',
  A: 'आ',
  i: 'इ',
  ee: 'ई',
  I: 'ई',
  u: 'उ',
  oo: 'ऊ',
  U: 'ऊ',
  ri: 'ऋ',
  R: 'ऋ',
  e: 'ए',
  ai: 'ऐ',
  o: 'ओ',
  au: 'औ',
  am: 'अं',
  an: 'अं',
  ah: 'अः',
};

const MATRA_MAP: Record<string, string> = {
  a: '',
  aa: 'ा',
  A: 'ा',
  i: 'ि',
  ee: 'ी',
  I: 'ी',
  u: 'ु',
  oo: 'ू',
  U: 'ू',
  ri: 'ृ',
  R: 'ृ',
  e: 'े',
  E: 'े',
  ai: 'ै',
  o: 'ो',
  O: 'ो',
  au: 'ौ',
  OU: 'ौ',
  am: 'ं',
  an: 'ं',
  ah: 'ः',
};

const CONSONANTS: [string, string][] = [
  ['ksh', 'क्ष'],
  ['gy', 'ज्ञ'],
  ['shr', 'श्र'],
  ['tr', 'त्र'],
  ['kh', 'ख'],
  ['gh', 'घ'],
  ['ng', 'ङ'],
  ['chh', 'छ'],
  ['ch', 'च'],
  ['jh', 'झ'],
  ['ny', 'ञ'],
  ['th', 'थ'],
  ['Th', 'ठ'],
  ['dh', 'ध'],
  ['Dh', 'ढ'],
  ['sh', 'श'],
  ['Sh', 'ष'],
  ['ph', 'फ'],
  ['bh', 'भ'],
  ['k', 'क'],
  ['g', 'ग'],
  ['j', 'ज'],
  ['T', 'ट'],
  ['D', 'ड'],
  ['N', 'ण'],
  ['t', 'त'],
  ['d', 'द'],
  ['n', 'न'],
  ['p', 'प'],
  ['f', 'फ'],
  ['b', 'ब'],
  ['m', 'म'],
  ['y', 'य'],
  ['r', 'र'],
  ['l', 'ल'],
  ['v', 'व'],
  ['w', 'व'],
  ['s', 'स'],
  ['h', 'ह'],
  ['q', 'क'],
  ['x', 'क्स'],
  ['z', 'ज़'],
];

const SPECIAL_WORDS: Record<string, string> = {
  namaste: 'नमस्ते',
  prarthana: 'प्रार्थना',
  dhanyavad: 'धन्यवाद',
  yeshu: 'यीशु',
  yishu: 'यीशु',
  mariam: 'मरियम',
  maryam: 'मरियम',
  isai: 'ईसाई',
  stuti: 'स्तुति',
  kripa: 'कृपा',
  shanti: 'शांति',
  prem: 'प्रेम',
  ashirwad: 'आशीर्वाद',
  mandir: 'मंदिर',
  girjaghar: 'गिरिजाघर',
  bhagwan: 'भगवान',
  bhakt: 'भक्त',
  atma: 'आत्मा',
  pavitra: 'पवित्र',
  krush: 'क्रूस',
  krus: 'क्रूस',
  papa: 'पापा',
  swarg: 'स्वर्ग',
  mukti: 'मुक्ति',
  doot: 'दूत',
  prabhu: 'प्रभु',
};

/**
 * Phonetically converts English words to Hindi Devanagari text.
 */
export function englishToHindi(text: string): string {
  if (!text) return '';

  return text
    .split(/(\s+|[.,!?;:()\[\]"'])/)
    .map((word) => {
      if (!word || /^\s+$/.test(word) || /^[.,!?;:()\[\]"']+$/.test(word)) {
        return word;
      }

      const lower = word.toLowerCase();
      if (SPECIAL_WORDS[lower]) {
        return SPECIAL_WORDS[lower];
      }

      return convertWord(word);
    })
    .join('');
}

function convertWord(word: string): string {
  let result = '';
  let i = 0;
  const n = word.length;

  while (i < n) {
    // 1. Check for standalone vowel at start of word or after space
    if (i === 0) {
      let matchedVowel = false;
      for (const v of ['aa', 'ee', 'oo', 'ai', 'au', 'ri', 'am', 'an', 'ah', 'a', 'A', 'i', 'I', 'u', 'U', 'e', 'E', 'o', 'O']) {
        if (word.startsWith(v, i)) {
          result += VOWELS_HI[v] || v;
          i += v.length;
          matchedVowel = true;
          break;
        }
      }
      if (matchedVowel) continue;
    }

    // 2. Check for consonants
    let matchedConsonant = false;
    for (const [cStr, cHindi] of CONSONANTS) {
      if (word.startsWith(cStr, i)) {
        i += cStr.length;
        matchedConsonant = true;

        // Check if virama / halant explicitly typed with semicolon ';' or '_'
        if (i < n && (word[i] === ';' || word[i] === '_')) {
          result += cHindi + '्';
          i++;
          break;
        }

        // Check for following vowel (Matra)
        let matchedMatra = false;
        for (const m of ['aa', 'ee', 'oo', 'ai', 'au', 'ri', 'am', 'an', 'ah', 'a', 'A', 'i', 'I', 'u', 'U', 'e', 'E', 'o', 'O']) {
          if (word.startsWith(m, i)) {
            result += cHindi + (MATRA_MAP[m] !== undefined ? MATRA_MAP[m] : '');
            i += m.length;
            matchedMatra = true;
            break;
          }
        }

        if (!matchedMatra) {
          // If followed immediately by another consonant or end of word
          if (i < n && isConsonantStart(word.substring(i))) {
            result += cHindi + '्'; // Half-letter (Halant)
          } else {
            result += cHindi; // Default inherent 'a' sound
          }
        }
        break;
      }
    }

    if (!matchedConsonant) {
      // Check for vowel in middle of word
      let matchedMidVowel = false;
      for (const v of ['aa', 'ee', 'oo', 'ai', 'au', 'ri', 'a', 'A', 'i', 'I', 'u', 'U', 'e', 'E', 'o', 'O']) {
        if (word.startsWith(v, i)) {
          result += VOWELS_HI[v] || v;
          i += v.length;
          matchedMidVowel = true;
          break;
        }
      }

      if (!matchedMidVowel) {
        result += word[i];
        i++;
      }
    }
  }

  return result;
}

function isConsonantStart(sub: string): boolean {
  for (const [c] of CONSONANTS) {
    if (sub.startsWith(c)) return true;
  }
  return false;
}
