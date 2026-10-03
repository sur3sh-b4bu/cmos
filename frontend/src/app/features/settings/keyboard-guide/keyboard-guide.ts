import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTabsModule } from '@angular/material/tabs';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { TranslatePipe } from '@ngx-translate/core';
import { baminiToUnicode } from '../../../core/utils/bamini-to-unicode.util';
import { englishToHindi } from '../../../core/utils/english-to-hindi.util';

export interface KeyItem {
  eng: string;
  tamil: string;
  label?: string;
  category: 'vowel' | 'consonant' | 'modifier' | 'grantha' | 'special' | 'other';
  example?: string;
  exampleTamil?: string;
  note?: string;
}

export interface KeyboardKey {
  key: string;
  shiftKey: string;
  tamilNormal: string;
  tamilShift: string;
  categoryNormal: 'vowel' | 'consonant' | 'modifier' | 'grantha' | 'special' | 'other';
  categoryShift: 'vowel' | 'consonant' | 'modifier' | 'grantha' | 'special' | 'other';
  width?: string;
}

export interface SampleWord {
  bamini: string;
  tamil: string;
  meaning: string;
}

@Component({
  selector: 'coms-keyboard-guide',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    MatIconModule,
    MatButtonModule,
    MatTabsModule,
    MatFormFieldModule,
    MatInputModule,
    MatChipsModule,
    MatTooltipModule,
    MatButtonToggleModule,
    TranslatePipe,
  ],
  templateUrl: './keyboard-guide.html',
  styleUrl: './keyboard-guide.scss',
})
export class KeyboardGuideComponent {
  // Active Guide Language: 'ta' (Tamil Bamini) or 'hi' (Hindi Phonetic)
  guideLang = signal<'ta' | 'hi'>('ta');

  // Practice Sandbox Signals
  practiceInput = signal('');
  shiftMode = signal(false);
  activeTab = signal(0);
  searchQuery = signal('');
  copied = signal(false);

  convertedText = computed(() => {
    const input = this.practiceInput();
    if (this.guideLang() === 'hi') {
      return englishToHindi(input);
    }
    return baminiToUnicode(input);
  });

  // Tamil Sample words
  sampleWordsTamil: SampleWord[] = [
    { bamini: 'jkpo;', tamil: 'தமிழ்', meaning: 'Tamil' },
    { bamini: 'khpahs;', tamil: 'மரியாள்', meaning: 'Mary' },
    { bamini: 'me;Njhdpahh;', tamil: 'அந்தோனியார்', meaning: 'St. Anthony' },
    { bamini: 'n[gk;', tamil: 'ஜெபம்', meaning: 'Prayer' },
    { bamini: 'ed;wpawpjy;', tamil: 'நன்றியறிதல்', meaning: 'Thanksgiving' },
    { bamini: 'jpUg;gyp', tamil: 'திருப்பலி', meaning: 'Holy Mass' },
    { bamini: 'NaR', tamil: 'இயேசு', meaning: 'Jesus' },
    { bamini: 'MNuhf;fpa khjh', tamil: 'ஆரோக்கிய மாதா', meaning: 'Our Lady of Good Health' },
    { bamini: 'n[hrg;', tamil: 'ஜோசப்', meaning: 'Joseph' },
    { bamini: 'kfpo;r;rp', tamil: 'மகிழ்ச்சி', meaning: 'Joy / Happiness' },
    { bamini: 'jpUKOf;F', tamil: 'திருமுழுக்கு', meaning: 'Baptism' },
    { bamini: 'jpUkzk;', tamil: 'திருமணம்', meaning: 'Marriage' },
  ];

  // Hindi Sample words
  sampleWordsHindi: SampleWord[] = [
    { bamini: 'namaste', tamil: 'नमस्ते', meaning: 'Greetings / Hello' },
    { bamini: 'prarthana', tamil: 'प्रार्थना', meaning: 'Prayer' },
    { bamini: 'yeshu', tamil: 'यीशु', meaning: 'Jesus' },
    { bamini: 'mariam', tamil: 'मरियम', meaning: 'Mother Mary' },
    { bamini: 'dhanyavad', tamil: 'धन्यवाद', meaning: 'Thanksgiving' },
    { bamini: 'girjaghar', tamil: 'गिरिजाघर', meaning: 'Church' },
    { bamini: 'pavitra', tamil: 'पवित्र', meaning: 'Holy' },
    { bamini: 'stuti', tamil: 'स्तुति', meaning: 'Praise / Worship' },
    { bamini: 'kripa', tamil: 'कृपा', meaning: 'Grace / Mercy' },
    { bamini: 'shanti', tamil: 'शांति', meaning: 'Peace' },
    { bamini: 'ashirwad', tamil: 'आशीर्वाद', meaning: 'Blessing' },
    { bamini: 'prabhu', tamil: 'प्रभु', meaning: 'Lord' },
  ];

  sampleWords = computed(() => {
    return this.guideLang() === 'hi' ? this.sampleWordsHindi : this.sampleWordsTamil;
  });

  // Visual Keyboard rows for Tamil
  keyboardRowsTamil: KeyboardKey[][] = [
    [
      { key: '`', shiftKey: '~', tamilNormal: 'ஹ', tamilShift: '~', categoryNormal: 'grantha', categoryShift: 'other' },
      { key: '1', shiftKey: '!', tamilNormal: '1', tamilShift: '!', categoryNormal: 'other', categoryShift: 'other' },
      { key: '2', shiftKey: '@', tamilNormal: '2', tamilShift: '@', categoryNormal: 'other', categoryShift: 'other' },
      { key: '3', shiftKey: '#', tamilNormal: '3', tamilShift: '#', categoryNormal: 'other', categoryShift: 'other' },
      { key: '4', shiftKey: '$', tamilNormal: '4', tamilShift: 'கூ', categoryNormal: 'other', categoryShift: 'special' },
      { key: '5', shiftKey: '%', tamilNormal: '5', tamilShift: 'மூ', categoryNormal: 'other', categoryShift: 'special' },
      { key: '6', shiftKey: '^', tamilNormal: '6', tamilShift: 'டூ', categoryNormal: 'other', categoryShift: 'special' },
      { key: '7', shiftKey: '&', tamilNormal: '7', tamilShift: 'ரூ', categoryNormal: 'other', categoryShift: 'special' },
      { key: '8', shiftKey: '*', tamilNormal: '8', tamilShift: 'ஙு', categoryNormal: 'other', categoryShift: 'special' },
      { key: '9', shiftKey: '(', tamilNormal: '9', tamilShift: '(', categoryNormal: 'other', categoryShift: 'other' },
      { key: '0', shiftKey: ')', tamilNormal: '0', tamilShift: ')', categoryNormal: 'other', categoryShift: 'other' },
      { key: '-', shiftKey: '_', tamilNormal: '-', tamilShift: '_', categoryNormal: 'other', categoryShift: 'other' },
      { key: '=', shiftKey: '+', tamilNormal: 'ஸ்ரீ', tamilShift: '+', categoryNormal: 'grantha', categoryShift: 'other' },
    ],
    [
      { key: 'q', shiftKey: 'Q', tamilNormal: 'ங', tamilShift: 'ஞ', categoryNormal: 'consonant', categoryShift: 'consonant' },
      { key: 'w', shiftKey: 'W', tamilNormal: 'ற', tamilShift: 'று', categoryNormal: 'consonant', categoryShift: 'special' },
      { key: 'e', shiftKey: 'E', tamilNormal: 'ந', tamilShift: 'நு', categoryNormal: 'consonant', categoryShift: 'special' },
      { key: 'r', shiftKey: 'R', tamilNormal: 'ச', tamilShift: 'சு', categoryNormal: 'consonant', categoryShift: 'special' },
      { key: 't', shiftKey: 'T', tamilNormal: 'வ', tamilShift: 'வு', categoryNormal: 'consonant', categoryShift: 'special' },
      { key: 'y', shiftKey: 'Y', tamilNormal: 'ல', tamilShift: 'லு', categoryNormal: 'consonant', categoryShift: 'special' },
      { key: 'u', shiftKey: 'U', tamilNormal: 'ர', tamilShift: 'ரு', categoryNormal: 'consonant', categoryShift: 'special' },
      { key: 'i', shiftKey: 'I', tamilNormal: 'ை (முன்)', tamilShift: 'ஐ', categoryNormal: 'modifier', categoryShift: 'vowel' },
      { key: 'o', shiftKey: 'O', tamilNormal: 'ழ', tamilShift: 'ழு', categoryNormal: 'consonant', categoryShift: 'special' },
      { key: 'p', shiftKey: 'P', tamilNormal: 'ி (இ-கரம்)', tamilShift: 'ீ (ஈ-காரம்)', categoryNormal: 'modifier', categoryShift: 'modifier' },
      { key: '[', shiftKey: '{', tamilNormal: 'ஜ', tamilShift: 'ஷு', categoryNormal: 'grantha', categoryShift: 'special' },
      { key: ']', shiftKey: '}', tamilNormal: 'ஸ', tamilShift: 'ஊ-குறி', categoryNormal: 'grantha', categoryShift: 'modifier' },
      { key: '\\', shiftKey: '|', tamilNormal: 'ஷ', tamilShift: '|', categoryNormal: 'grantha', categoryShift: 'other' },
    ],
    [
      { key: 'a', shiftKey: 'A', tamilNormal: 'ய', tamilShift: 'A', categoryNormal: 'consonant', categoryShift: 'other' },
      { key: 's', shiftKey: 'S', tamilNormal: 'ள', tamilShift: 'ளு', categoryNormal: 'consonant', categoryShift: 'special' },
      { key: 'd', shiftKey: 'D', tamilNormal: 'ன', tamilShift: 'னு', categoryNormal: 'consonant', categoryShift: 'special' },
      { key: 'f', shiftKey: 'F', tamilNormal: 'க', tamilShift: 'கு', categoryNormal: 'consonant', categoryShift: 'special' },
      { key: 'g', shiftKey: 'G', tamilNormal: 'ப', tamilShift: 'பு', categoryNormal: 'consonant', categoryShift: 'special' },
      { key: 'h', shiftKey: 'H', tamilNormal: 'ா (துணை)', tamilShift: 'H', categoryNormal: 'modifier', categoryShift: 'other' },
      { key: 'j', shiftKey: 'J', tamilNormal: 'த', tamilShift: 'து', categoryNormal: 'consonant', categoryShift: 'special' },
      { key: 'k', shiftKey: 'K', tamilNormal: 'ம', tamilShift: 'மு', categoryNormal: 'consonant', categoryShift: 'special' },
      { key: 'l', shiftKey: 'L', tamilNormal: 'ட', tamilShift: 'டு', categoryNormal: 'consonant', categoryShift: 'special' },
      { key: ';', shiftKey: ':', tamilNormal: '் (புள்ளி)', tamilShift: ':', categoryNormal: 'modifier', categoryShift: 'other' },
      { key: '\'', shiftKey: '"', tamilNormal: '\'', tamilShift: '"', categoryNormal: 'other', categoryShift: 'other' },
    ],
    [
      { key: 'z', shiftKey: 'Z', tamilNormal: 'ண', tamilShift: 'ணு', categoryNormal: 'consonant', categoryShift: 'special' },
      { key: 'x', shiftKey: 'X', tamilNormal: 'ஒ', tamilShift: 'ஓ', categoryNormal: 'vowel', categoryShift: 'vowel' },
      { key: 'c', shiftKey: 'C', tamilNormal: 'உ', tamilShift: 'ஊ', categoryNormal: 'vowel', categoryShift: 'vowel' },
      { key: 'v', shiftKey: 'V', tamilNormal: 'எ', tamilShift: 'ஏ', categoryNormal: 'vowel', categoryShift: 'vowel' },
      { key: 'b', shiftKey: 'B', tamilNormal: 'டி', tamilShift: 'டீ', categoryNormal: 'special', categoryShift: 'special' },
      { key: 'n', shiftKey: 'N', tamilNormal: 'ெ (முன்)', tamilShift: 'ே (முன்)', categoryNormal: 'modifier', categoryShift: 'modifier' },
      { key: 'm', shiftKey: 'M', tamilNormal: 'அ', tamilShift: 'ஆ', categoryNormal: 'vowel', categoryShift: 'vowel' },
      { key: ',', shiftKey: '<', tamilNormal: 'இ', tamilShift: 'ஈ', categoryNormal: 'vowel', categoryShift: 'vowel' },
      { key: '.', shiftKey: '>', tamilNormal: '.', tamilShift: '>', categoryNormal: 'other', categoryShift: 'other' },
      { key: '/', shiftKey: '?', tamilNormal: 'ஃ', tamilShift: '?', categoryNormal: 'vowel', categoryShift: 'other' },
    ],
  ];

  // Visual Keyboard rows for Hindi (Phonetic / Inscript style)
  keyboardRowsHindi: KeyboardKey[][] = [
    [
      { key: '`', shiftKey: '~', tamilNormal: '़ (nuqta)', tamilShift: '~', categoryNormal: 'modifier', categoryShift: 'other' },
      { key: '1', shiftKey: '!', tamilNormal: '1 / १', tamilShift: '!', categoryNormal: 'other', categoryShift: 'other' },
      { key: '2', shiftKey: '@', tamilNormal: '2 / २', tamilShift: '@', categoryNormal: 'other', categoryShift: 'other' },
      { key: '3', shiftKey: '#', tamilNormal: '3 / ३', tamilShift: '#', categoryNormal: 'other', categoryShift: 'other' },
      { key: '4', shiftKey: '$', tamilNormal: '4 / ४', tamilShift: '₹', categoryNormal: 'other', categoryShift: 'other' },
      { key: '5', shiftKey: '%', tamilNormal: '5 / ५', tamilShift: '%', categoryNormal: 'other', categoryShift: 'other' },
      { key: '6', shiftKey: '^', tamilNormal: '6 / ६', tamilShift: '^', categoryNormal: 'other', categoryShift: 'other' },
      { key: '7', shiftKey: '&', tamilNormal: '7 / ७', tamilShift: '&', categoryNormal: 'other', categoryShift: 'other' },
      { key: '8', shiftKey: '*', tamilNormal: '8 / ८', tamilShift: '*', categoryNormal: 'other', categoryShift: 'other' },
      { key: '9', shiftKey: '(', tamilNormal: '9 / ९', tamilShift: '(', categoryNormal: 'other', categoryShift: 'other' },
      { key: '0', shiftKey: ')', tamilNormal: '0 / ०', tamilShift: ')', categoryNormal: 'other', categoryShift: 'other' },
      { key: '-', shiftKey: '_', tamilNormal: '-', tamilShift: '_', categoryNormal: 'other', categoryShift: 'other' },
      { key: '=', shiftKey: '+', tamilNormal: 'ृ (ri)', tamilShift: 'ऋ', categoryNormal: 'modifier', categoryShift: 'vowel' },
    ],
    [
      { key: 'q', shiftKey: 'Q', tamilNormal: 'क (q)', tamilShift: 'क़', categoryNormal: 'consonant', categoryShift: 'consonant' },
      { key: 'w', shiftKey: 'W', tamilNormal: 'व (w)', tamilShift: 'व', categoryNormal: 'consonant', categoryShift: 'consonant' },
      { key: 'e', shiftKey: 'E', tamilNormal: 'ए / े (e)', tamilShift: 'ऐ / ै', categoryNormal: 'vowel', categoryShift: 'vowel' },
      { key: 'r', shiftKey: 'R', tamilNormal: 'र (r)', tamilShift: 'ऋ (R)', categoryNormal: 'consonant', categoryShift: 'vowel' },
      { key: 't', shiftKey: 'T', tamilNormal: 'त (t)', tamilShift: 'ट (T)', categoryNormal: 'consonant', categoryShift: 'consonant' },
      { key: 'y', shiftKey: 'Y', tamilNormal: 'य (y)', tamilShift: 'ञ (ny)', categoryNormal: 'consonant', categoryShift: 'consonant' },
      { key: 'u', shiftKey: 'U', tamilNormal: 'उ / ु (u)', tamilShift: 'ऊ / ू (U)', categoryNormal: 'vowel', categoryShift: 'vowel' },
      { key: 'i', shiftKey: 'I', tamilNormal: 'इ / ि (i)', tamilShift: 'ई / ी (I)', categoryNormal: 'vowel', categoryShift: 'vowel' },
      { key: 'o', shiftKey: 'O', tamilNormal: 'ओ / ो (o)', tamilShift: 'औ / ौ (O)', categoryNormal: 'vowel', categoryShift: 'vowel' },
      { key: 'p', shiftKey: 'P', tamilNormal: 'प (p)', tamilShift: 'फ (ph)', categoryNormal: 'consonant', categoryShift: 'consonant' },
      { key: '[', shiftKey: '{', tamilNormal: 'ढ (Dh)', tamilShift: 'ध (dh)', categoryNormal: 'consonant', categoryShift: 'consonant' },
      { key: ']', shiftKey: '}', tamilNormal: '़ (ं am)', tamilShift: 'ँ (an)', categoryNormal: 'modifier', categoryShift: 'modifier' },
      { key: '\\', shiftKey: '|', tamilNormal: '् (halant)', tamilShift: '। (danda)', categoryNormal: 'modifier', categoryShift: 'other' },
    ],
    [
      { key: 'a', shiftKey: 'A', tamilNormal: 'अ / ा (a)', tamilShift: 'आ / ा (A)', categoryNormal: 'vowel', categoryShift: 'vowel' },
      { key: 's', shiftKey: 'S', tamilNormal: 'स (s)', tamilShift: 'श (Sh)', categoryNormal: 'consonant', categoryShift: 'consonant' },
      { key: 'd', shiftKey: 'D', tamilNormal: 'द (d)', tamilShift: 'ड (D)', categoryNormal: 'consonant', categoryShift: 'consonant' },
      { key: 'f', shiftKey: 'F', tamilNormal: 'फ (f)', tamilShift: 'फ़', categoryNormal: 'consonant', categoryShift: 'consonant' },
      { key: 'g', shiftKey: 'G', tamilNormal: 'ग (g)', tamilShift: 'घ (gh)', categoryNormal: 'consonant', categoryShift: 'consonant' },
      { key: 'h', shiftKey: 'H', tamilNormal: 'ह (h)', tamilShift: 'ः (ah)', categoryNormal: 'consonant', categoryShift: 'modifier' },
      { key: 'j', shiftKey: 'J', tamilNormal: 'ज (j)', tamilShift: 'झ (jh)', categoryNormal: 'consonant', categoryShift: 'consonant' },
      { key: 'k', shiftKey: 'K', tamilNormal: 'क (k)', tamilShift: 'ख (kh)', categoryNormal: 'consonant', categoryShift: 'consonant' },
      { key: 'l', shiftKey: 'L', tamilNormal: 'ल (l)', tamilShift: 'ळ (L)', categoryNormal: 'consonant', categoryShift: 'consonant' },
      { key: ';', shiftKey: ':', tamilNormal: '् (halant)', tamilShift: 'ः (visarga)', categoryNormal: 'modifier', categoryShift: 'modifier' },
      { key: '\'', shiftKey: '"', tamilNormal: '\'', tamilShift: '"', categoryNormal: 'other', categoryShift: 'other' },
    ],
    [
      { key: 'z', shiftKey: 'Z', tamilNormal: 'ज़ (z)', tamilShift: 'ज्ञ (gy)', categoryNormal: 'consonant', categoryShift: 'special' },
      { key: 'x', shiftKey: 'X', tamilNormal: 'क्ष (ksh)', tamilShift: 'त्र (tr)', categoryNormal: 'special', categoryShift: 'special' },
      { key: 'c', shiftKey: 'C', tamilNormal: 'च (ch)', tamilShift: 'छ (chh)', categoryNormal: 'consonant', categoryShift: 'consonant' },
      { key: 'v', shiftKey: 'V', tamilNormal: 'व (v)', tamilShift: 'श्र (shr)', categoryNormal: 'consonant', categoryShift: 'special' },
      { key: 'b', shiftKey: 'B', tamilNormal: 'ब (b)', tamilShift: 'भ (bh)', categoryNormal: 'consonant', categoryShift: 'consonant' },
      { key: 'n', shiftKey: 'N', tamilNormal: 'न (n)', tamilShift: 'ण (N)', categoryNormal: 'consonant', categoryShift: 'consonant' },
      { key: 'm', shiftKey: 'M', tamilNormal: 'म (m)', tamilShift: 'ं (anusvara)', categoryNormal: 'consonant', categoryShift: 'modifier' },
      { key: ',', shiftKey: '<', tamilNormal: ',', tamilShift: '<', categoryNormal: 'other', categoryShift: 'other' },
      { key: '.', shiftKey: '>', tamilNormal: '.', tamilShift: '।', categoryNormal: 'other', categoryShift: 'other' },
      { key: '/', shiftKey: '?', tamilNormal: '/', tamilShift: '?', categoryNormal: 'other', categoryShift: 'other' },
    ],
  ];

  keyboardRows = computed(() => {
    return this.guideLang() === 'hi' ? this.keyboardRowsHindi : this.keyboardRowsTamil;
  });

  // Tamil Vowels
  vowelsTamil: KeyItem[] = [
    { eng: 'm', tamil: 'அ', category: 'vowel', example: 'm', exampleTamil: 'அ' },
    { eng: 'M (Shift + m)', tamil: 'ஆ', category: 'vowel', example: 'Mkh', exampleTamil: 'ஆமா' },
    { eng: ',', tamil: 'இ', category: 'vowel', example: ',ul;rp', exampleTamil: 'இரட்சி' },
    { eng: '< (Shift + ,)', tamil: 'ஈ', category: 'vowel', example: '<r', exampleTamil: 'ஈச' },
    { eng: 'c', tamil: 'உ', category: 'vowel', example: 'cyfk;', exampleTamil: 'உலகம்' },
    { eng: 'C (Shift + c)', tamil: 'ஊ', category: 'vowel', example: 'Cjpak;', exampleTamil: 'ஊதியம்' },
    { eng: 'v', tamil: 'எ', category: 'vowel', example: 'ez;gd;', exampleTamil: 'எண்ணன்' },
    { eng: 'V (Shift + v)', tamil: 'ஏ', category: 'vowel', example: 'Vw;W', exampleTamil: 'ஏற்று' },
    { eng: 'I (Shift + i)', tamil: 'ஐ', category: 'vowel', example: 'Iah', exampleTamil: 'ஐயா' },
    { eng: 'x', tamil: 'ஒ', category: 'vowel', example: 'xd;W', exampleTamil: 'ஒன்று' },
    { eng: 'X (Shift + x)', tamil: 'ஓ', category: 'vowel', example: 'Xk;', exampleTamil: 'ஓம்' },
    { eng: 'xs (x + s)', tamil: 'ஔ', category: 'vowel', example: 'xsitahh;', exampleTamil: 'ஔவையார்' },
    { eng: '/', tamil: 'ஃ', category: 'vowel', note: 'ஆய்த எழுத்து', example: 'm/J', exampleTamil: 'அஃது' },
  ];

  // Hindi Vowels (स्वर)
  vowelsHindi: KeyItem[] = [
    { eng: 'a', tamil: 'अ', category: 'vowel', example: 'anar', exampleTamil: 'अनार' },
    { eng: 'aa / A', tamil: 'आ', category: 'vowel', example: 'aam / Aam', exampleTamil: 'आम' },
    { eng: 'i', tamil: 'इ', category: 'vowel', example: 'imli', exampleTamil: 'इमली' },
    { eng: 'ee / I', tamil: 'ई', category: 'vowel', example: 'eeshwar / Ishwar', exampleTamil: 'ईश्वर' },
    { eng: 'u', tamil: 'उ', category: 'vowel', example: 'upahar', exampleTamil: 'उपहार' },
    { eng: 'oo / U', tamil: 'ऊ', category: 'vowel', example: 'oon / Oon', exampleTamil: 'ऊन' },
    { eng: 'ri / R', tamil: 'ऋ', category: 'vowel', example: 'rishi', exampleTamil: 'ऋषि' },
    { eng: 'e', tamil: 'ए', category: 'vowel', example: 'ek', exampleTamil: 'एक' },
    { eng: 'ai', tamil: 'ऐ', category: 'vowel', example: 'ainak', exampleTamil: 'ऐनक' },
    { eng: 'o', tamil: 'ओ', category: 'vowel', example: 'om', exampleTamil: 'ओम' },
    { eng: 'au / ou', tamil: 'औ', category: 'vowel', example: 'aurat', exampleTamil: 'औरत' },
    { eng: 'am / an', tamil: 'अं', category: 'vowel', example: 'angoor', exampleTamil: 'अंगूर' },
    { eng: 'ah / H', tamil: 'अः', category: 'vowel', example: 'namah', exampleTamil: 'नमः' },
  ];

  vowels = computed(() => (this.guideLang() === 'hi' ? this.vowelsHindi : this.vowelsTamil));

  // Tamil Consonants
  consonantsTamil: KeyItem[] = [
    { eng: 'f', tamil: 'க', category: 'consonant', note: 'க் = f;' },
    { eng: 'q', tamil: 'ங', category: 'consonant', note: 'ங் = q;' },
    { eng: 'r', tamil: 'ச', category: 'consonant', note: 'ச் = r;' },
    { eng: 'Q (Shift + q)', tamil: 'ஞ', category: 'consonant', note: 'ஞ் = Q;' },
    { eng: 'l', tamil: 'ட', category: 'consonant', note: 'ட் = l;' },
    { eng: 'z', tamil: 'ண', category: 'consonant', note: 'ண் = z;' },
    { eng: 'j', tamil: 'த', category: 'consonant', note: 'த் = j;' },
    { eng: 'e', tamil: 'ந', category: 'consonant', note: 'ந் = e;' },
    { eng: 'g', tamil: 'ப', category: 'consonant', note: 'ப் = g;' },
    { eng: 'k', tamil: 'ம', category: 'consonant', note: 'ம் = k;' },
    { eng: 'a', tamil: 'ய', category: 'consonant', note: 'ய் = a;' },
    { eng: 'u', tamil: 'ர', category: 'consonant', note: 'ர் = u;' },
    { eng: 'y', tamil: 'ல', category: 'consonant', note: 'ல் = y;' },
    { eng: 't', tamil: 'வ', category: 'consonant', note: 'வ் = t;' },
    { eng: 'o', tamil: 'ழ', category: 'consonant', note: 'ழ் = o;' },
    { eng: 's', tamil: 'ள', category: 'consonant', note: 'ள் = s;' },
    { eng: 'w', tamil: 'ற', category: 'consonant', note: 'ற் = w;' },
    { eng: 'd', tamil: 'ன', category: 'consonant', note: 'ன் = d;' },
  ];

  // Hindi Consonants (व्यंजन)
  consonantsHindi: KeyItem[] = [
    { eng: 'k', tamil: 'क', category: 'consonant', example: 'kamal', exampleTamil: 'कमल' },
    { eng: 'kh', tamil: 'ख', category: 'consonant', example: 'khar', exampleTamil: 'खर' },
    { eng: 'g', tamil: 'ग', category: 'consonant', example: 'gagan', exampleTamil: 'गगन' },
    { eng: 'gh', tamil: 'घ', category: 'consonant', example: 'ghar', exampleTamil: 'घर' },
    { eng: 'ng', tamil: 'ङ', category: 'consonant', example: 'anga', exampleTamil: 'अंग' },
    { eng: 'ch', tamil: 'च', category: 'consonant', example: 'chamatkar', exampleTamil: 'चमत्कार' },
    { eng: 'chh', tamil: 'छ', category: 'consonant', example: 'chhatri', exampleTamil: 'छतरी' },
    { eng: 'j', tamil: 'ज', category: 'consonant', example: 'jal', exampleTamil: 'जल' },
    { eng: 'jh', tamil: 'झ', category: 'consonant', example: 'jharana', exampleTamil: 'झरना' },
    { eng: 'ny', tamil: 'ञ', category: 'consonant', example: 'gyan', exampleTamil: 'ज्ञान' },
    { eng: 'T', tamil: 'ट', category: 'consonant', example: 'Tamatar', exampleTamil: 'टमाटर' },
    { eng: 'Th', tamil: 'ठ', category: 'consonant', example: 'Thakur', exampleTamil: 'ठाकुर' },
    { eng: 'D', tamil: 'ड', category: 'consonant', example: 'Damroo', exampleTamil: 'डमरू' },
    { eng: 'Dh', tamil: 'ढ', category: 'consonant', example: 'Dhakan', exampleTamil: 'ढकन' },
    { eng: 'N', tamil: 'ण', category: 'consonant', example: 'baN', exampleTamil: 'बाण' },
    { eng: 't', tamil: 'त', category: 'consonant', example: 'tarang', exampleTamil: 'तरंग' },
    { eng: 'th', tamil: 'थ', category: 'consonant', example: 'thali', exampleTamil: 'थाली' },
    { eng: 'd', tamil: 'द', category: 'consonant', example: 'daya', exampleTamil: 'दया' },
    { eng: 'dh', tamil: 'ध', category: 'consonant', example: 'dhan', exampleTamil: 'धन' },
    { eng: 'n', tamil: 'न', category: 'consonant', example: 'naman', exampleTamil: 'नमन' },
    { eng: 'p', tamil: 'प', category: 'consonant', example: 'pawan', exampleTamil: 'पवन' },
    { eng: 'ph / f', tamil: 'फ', category: 'consonant', example: 'fal', exampleTamil: 'फल' },
    { eng: 'b', tamil: 'ब', category: 'consonant', example: 'balak', exampleTamil: 'बालक' },
    { eng: 'bh', tamil: 'भ', category: 'consonant', example: 'bhakti', exampleTamil: 'भक्ति' },
    { eng: 'm', tamil: 'म', category: 'consonant', example: 'man', exampleTamil: 'मन' },
    { eng: 'y', tamil: 'य', category: 'consonant', example: 'yash', exampleTamil: 'यश' },
    { eng: 'r', tamil: 'र', category: 'consonant', example: 'ram', exampleTamil: 'राम' },
    { eng: 'l', tamil: 'ल', category: 'consonant', example: 'lata', exampleTamil: 'लता' },
    { eng: 'v / w', tamil: 'व', category: 'consonant', example: 'vachan', exampleTamil: 'वचन' },
    { eng: 'sh', tamil: 'श', category: 'consonant', example: 'shanti', exampleTamil: 'शांति' },
    { eng: 'Sh', tamil: 'ष', category: 'consonant', example: 'dhanuSh', exampleTamil: 'धनुष' },
    { eng: 's', tamil: 'स', category: 'consonant', example: 'satya', exampleTamil: 'सत्य' },
    { eng: 'h', tamil: 'ह', category: 'consonant', example: 'hath', exampleTamil: 'हाथ' },
    { eng: 'ksh', tamil: 'क्ष', category: 'special', example: 'kripa', exampleTamil: 'कृपा' },
    { eng: 'tr', tamil: 'त्र', category: 'special', example: 'trinetra', exampleTamil: 'त्रिनेत्र' },
    { eng: 'gy', tamil: 'ज्ञ', category: 'special', example: 'gyan', exampleTamil: 'ज्ञान' },
    { eng: 'shr', tamil: 'श्र', category: 'special', example: 'shradha', exampleTamil: 'श्रद्धा' },
  ];

  consonants = computed(() => (this.guideLang() === 'hi' ? this.consonantsHindi : this.consonantsTamil));

  // Modifiers
  modifiersTamil: KeyItem[] = [
    { eng: ';', tamil: '் (புள்ளி)', category: 'modifier', note: 'எழுத்தின் பின் தட்டச்சு செய்யவும்', example: 'f; , k;', exampleTamil: 'க் , ம்' },
    { eng: 'h', tamil: 'ா (துணைக்கால்)', category: 'modifier', note: 'ஆ-வரிசை (எழுத்தின் பின்)', example: 'fh , kh', exampleTamil: 'கா , மா' },
    { eng: 'p', tamil: 'ி (இ-கரம்)', category: 'modifier', note: 'இ-வரிசை (எழுத்தின் பின்)', example: 'fp , kp , jp', exampleTamil: 'கி , மி , தி' },
    { eng: 'P (Shift + p)', tamil: 'ீ (ஈ-காரம்)', category: 'modifier', note: 'ஈ-வரிசை (எழுத்தின் பின்)', example: 'fP , kP , jP', exampleTamil: 'கீ , மீ , தீ' },
    { eng: 'n', tamil: 'ெ (ஒற்றைக் கொம்பு)', category: 'modifier', note: 'எ-வரிசை: எழுத்துக்கு முன் "n" தட்டச்சு செய்யவும்', example: 'nf , nk , nj', exampleTamil: 'கெ , மெ , தெ' },
    { eng: 'N (Shift + n)', tamil: 'ே (இரட்டைக் கொம்பு)', category: 'modifier', note: 'ஏ-வரிசை: எழுத்துக்கு முன் "N" தட்டச்சு செய்யவும்', example: 'Nf , Nk , Nj', exampleTamil: 'கே , மே , தே' },
    { eng: 'i', tamil: 'ை (இணைக்கொம்பு)', category: 'modifier', note: 'ஐ-வரிசை: எழுத்துக்கு முன் "i" தட்டச்சு செய்யவும்', example: 'if , ik , ij', exampleTamil: 'கை , மை , தை' },
    { eng: 'n + எழுத்து + h', tamil: 'ொ (ஒ-கரம்)', category: 'modifier', note: 'ஒ-வரிசை: முன் "n", பின் "h"', example: 'nfh , nkh , njh', exampleTamil: 'கொ , மொ , தொ' },
    { eng: 'N + எழுத்து + h', tamil: 'ோ (ஓ-காரம்)', category: 'modifier', note: 'ஓ-வரிசை: முன் "N", பின் "h"', example: 'Nfh , Nkh , Njh', exampleTamil: 'கோ , மோ , தோ' },
    { eng: 'n + எழுத்து + s', tamil: 'ௌ (ஔ-காரம்)', category: 'modifier', note: 'ஔ-வரிசை: முன் "n", பின் "s"', example: 'nfs , nks , njs', exampleTamil: 'கௌ , மௌ , தௌ' },
  ];

  modifiersHindi: KeyItem[] = [
    { eng: 'aa / A', tamil: 'ा (आ की मात्रा)', category: 'modifier', example: 'kaa / kA', exampleTamil: 'का' },
    { eng: 'i', tamil: 'ि (इ की मात्रा)', category: 'modifier', example: 'ki', exampleTamil: 'कि' },
    { eng: 'ee / I', tamil: 'ी (ई की मात्रा)', category: 'modifier', example: 'kee / kI', exampleTamil: 'की' },
    { eng: 'u', tamil: 'ु (उ की मात्रा)', category: 'modifier', example: 'ku', exampleTamil: 'कु' },
    { eng: 'oo / U', tamil: 'ू (ऊ की मात्रा)', category: 'modifier', example: 'koo / kU', exampleTamil: 'कू' },
    { eng: 'ri / R', tamil: 'ृ (ऋ की मात्रा)', category: 'modifier', example: 'kri', exampleTamil: 'कृ' },
    { eng: 'e', tamil: 'े (ए की मात्रा)', category: 'modifier', example: 'ke', exampleTamil: 'के' },
    { eng: 'ai', tamil: 'ै (ऐ की मात्रा)', category: 'modifier', example: 'kai', exampleTamil: 'कै' },
    { eng: 'o', tamil: 'ो (ओ की मात्रा)', category: 'modifier', example: 'ko', exampleTamil: 'को' },
    { eng: 'au / ou', tamil: 'ौ (औ की मात्रा)', category: 'modifier', example: 'kau', exampleTamil: 'कौ' },
    { eng: 'am / an / M', tamil: 'ं (अनुस्वार)', category: 'modifier', example: 'kam', exampleTamil: 'कं' },
    { eng: 'ah / H', tamil: 'ः (विसर्ग)', category: 'modifier', example: 'namah', exampleTamil: 'नमः' },
    { eng: '; / _ (consonant + consonant)', tamil: '् (हलंत / आधा अक्षर)', category: 'modifier', example: 'pra / sta', exampleTamil: 'प्र / स्त' },
  ];

  modifiers = computed(() => (this.guideLang() === 'hi' ? this.modifiersHindi : this.modifiersTamil));

  // Special U / UU mappings for Tamil
  specialUForms: KeyItem[] = [
    { eng: 'F (Shift + f)', tamil: 'கு', category: 'special', example: 'Fuk;', exampleTamil: 'குரம்' },
    { eng: '$ (Shift + 4)', tamil: 'கூ', category: 'special', example: '$L', exampleTamil: 'கூடு' },
    { eng: 'R (Shift + r)', tamil: 'சு', category: 'special', example: 'Re;jh;', exampleTamil: 'சுந்தர்' },
    { eng: 'R+ (Shift + r, then +)', tamil: 'சூ', category: 'special', example: 'R+hpad;', exampleTamil: 'சூரியன்' },
    { eng: 'b', tamil: 'டி', category: 'special', example: 'tpL', exampleTamil: 'விடு' },
    { eng: 'B (Shift + b)', tamil: 'டீ', category: 'special', example: 'tB', exampleTamil: 'வீடீ' },
    { eng: 'L (Shift + l)', tamil: 'டு', category: 'special', example: 'FLk;gk;', exampleTamil: 'குடும்பம்' },
    { eng: '^ (Shift + 6)', tamil: 'டூ', category: 'special', example: '^j;J', exampleTamil: 'டூத்து' },
    { eng: 'J (Shift + j)', tamil: 'து', category: 'special', example: 'Jjp', exampleTamil: 'துதி' },
    { eng: 'J} (Shift + j, then })', tamil: 'தூ', category: 'special', example: 'J}ath;', exampleTamil: 'தூயவர்' },
    { eng: 'G (Shift + g)', tamil: 'பு', category: 'special', example: 'Gfy;', exampleTamil: 'புகல்' },
    { eng: 'G+ (Shift + g, then +)', tamil: 'பூ', category: 'special', example: 'G+id', exampleTamil: 'பூனை' },
    { eng: 'K (Shift + k)', tamil: 'மு', category: 'special', example: 'Kjy;', exampleTamil: 'முதல்' },
    { eng: '% (Shift + 5)', tamil: 'மூ', category: 'special', example: '%d;W', exampleTamil: 'மூன்று' },
    { eng: 'U (Shift + u)', tamil: 'ரு', category: 'special', example: 'mUs;', exampleTamil: 'அருள்' },
    { eng: '& (Shift + 7)', tamil: 'ரூ', category: 'special', example: '&gha;', exampleTamil: 'ரூபாய்' },
    { eng: 'Y (Shift + y)', tamil: 'லு', category: 'special', example: 'mYtyfk;', exampleTamil: 'அலுவலகம்' },
    { eng: 'Y} (Shift + y, then })', tamil: 'லூ', category: 'special', example: 'Y}h;J', exampleTamil: 'லூர்து' },
    { eng: 'T (Shift + t)', tamil: 'வு', category: 'special', example: 'fTdp', exampleTamil: 'கவுனி' },
    { eng: 'T+ (Shift + t, then +)', tamil: 'வூ', category: 'special', example: 'T+j;J', exampleTamil: 'வூத்து' },
    { eng: 'O (Shift + o)', tamil: 'ழு', category: 'special', example: 'vOJ', exampleTamil: 'எழுது' },
    { eng: 'S (Shift + s)', tamil: 'ளு', category: 'special', example: 'tsUs;', exampleTamil: 'வளருள்' },
    { eng: 'Sh (Shift + s, then h)', tamil: 'ளூ', category: 'special', example: 'Shh;', exampleTamil: 'ளூர்' },
    { eng: 'W (Shift + w)', tamil: 'று', category: 'special', example: 'mjpW', exampleTamil: 'அதிறு' },
    { eng: 'W} (Shift + w, then })', tamil: 'றூ', category: 'special', example: 'W}l;', exampleTamil: 'றூட்' },
    { eng: 'D (Shift + d)', tamil: 'னு', category: 'special', example: 'kDePjp', exampleTamil: 'மனுநீதி' },
    { eng: 'D} (Shift + d, then })', tamil: 'னூ', category: 'special', example: 'D}y;', exampleTamil: 'னூல்' },
    { eng: 'Z (Shift + z)', tamil: 'ணு', category: 'special', example: 'fZZ;z', exampleTamil: 'கண்ணு' },
    { eng: 'Z} (Shift + z, then })', tamil: 'ணூ', category: 'special', example: 'Z}y;', exampleTamil: 'ணூல்' },
    { eng: 'E (Shift + e)', tamil: 'நு', category: 'special', example: 'Ezp', exampleTamil: 'நுனி' },
    { eng: 'E} (Shift + e, then })', tamil: 'நூ', category: 'special', example: 'E}y;', exampleTamil: 'நூல்' },
  ];

  // Grantha letters for Tamil
  grantha: KeyItem[] = [
    { eng: '[', tamil: 'ஜ', category: 'grantha', note: 'ஜ் = [;' },
    { eng: '\\', tamil: 'ஷ', category: 'grantha', note: 'ஷ் = \\;' },
    { eng: ']', tamil: 'ஸ', category: 'grantha', note: 'ஸ் = ];' },
    { eng: '`', tamil: 'ஹ', category: 'grantha', note: 'ஹ் = `;' },
    { eng: '=', tamil: 'ஸ்ரீ', category: 'grantha', note: 'ஸ்ரீ' },
    { eng: 'f;\\ (f ; \\)', tamil: 'க்ஷ', category: 'grantha', note: 'க்ஷ' },
    { eng: '[h', tamil: 'ஜா', category: 'grantha' },
    { eng: '[p', tamil: 'ஜி', category: 'grantha' },
    { eng: '[P', tamil: 'ஜீ', category: 'grantha' },
    { eng: '[{', tamil: 'ஜு', category: 'grantha' },
    { eng: '[_', tamil: 'ஜூ', category: 'grantha' },
    { eng: 'n[', tamil: 'ஜெ', category: 'grantha' },
    { eng: 'N[', tamil: 'ஜே', category: 'grantha' },
    { eng: 'i[', tamil: 'ஜை', category: 'grantha' },
    { eng: 'N[h', tamil: 'ஜோ', category: 'grantha' },
  ];

  // Filtered computed signals
  filteredVowels = computed(() => this.filterItems(this.vowels()));
  filteredConsonants = computed(() => this.filterItems(this.consonants()));
  filteredModifiers = computed(() => this.filterItems(this.modifiers()));
  filteredSpecialUForms = computed(() => this.filterItems(this.specialUForms));
  filteredGrantha = computed(() => this.filterItems(this.grantha));

  private filterItems(items: KeyItem[]): KeyItem[] {
    const q = this.searchQuery().trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (item) =>
        item.eng.toLowerCase().includes(q) ||
        item.tamil.toLowerCase().includes(q) ||
        (item.note && item.note.toLowerCase().includes(q)) ||
        (item.example && item.example.toLowerCase().includes(q)) ||
        (item.exampleTamil && item.exampleTamil.toLowerCase().includes(q))
    );
  }

  setGuideLang(lang: 'ta' | 'hi'): void {
    this.guideLang.set(lang);
    this.practiceInput.set('');
  }

  insertSample(sample: SampleWord): void {
    this.practiceInput.set(sample.bamini);
  }

  insertKey(char: string): void {
    this.practiceInput.update((curr) => curr + char);
  }

  clearPractice(): void {
    this.practiceInput.set('');
  }

  toggleShift(): void {
    this.shiftMode.update((v) => !v);
  }

  copyConverted(): void {
    const text = this.convertedText();
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2000);
    });
  }
}
