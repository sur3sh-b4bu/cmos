import { en } from './en';
import { ta } from './ta';

export type AppLang = 'en' | 'ta';

export const TRANSLATIONS: Record<AppLang, Record<string, unknown>> = { en, ta };
