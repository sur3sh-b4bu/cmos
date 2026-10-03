import { en } from './en';
import { ta } from './ta';
import { hi } from './hi';

export type AppLang = 'en' | 'ta' | 'hi';

export const TRANSLATIONS: Record<AppLang, Record<string, unknown>> = { en, ta, hi };
