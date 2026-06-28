import { createContext, useContext } from 'react';
import type { Translations } from './locales/types';
import { JA } from './locales/ja';
import { EN } from './locales/en';

/** Supported UI languages. */
export type Lang = 'ja' | 'en';

export type { Translations } from './locales/types';
export { JA, EN };

/** React Context providing the active translation object. */
export const LangContext = createContext<Translations>(JA);

/** Returns the translation object for the current popup language. */
export function useLang(): Translations {
  return useContext(LangContext);
}
