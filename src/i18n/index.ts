import type { Locale } from './config';
import type { Dictionary } from './types';
import en from './dictionaries/en';
import es from './dictionaries/es';
import pt from './dictionaries/pt';
import fr from './dictionaries/fr';
import de from './dictionaries/de';
import ru from './dictionaries/ru';
import tr from './dictionaries/tr';
import id from './dictionaries/id';
import hi from './dictionaries/hi';
import ur from './dictionaries/ur';
import ar from './dictionaries/ar';
import ja from './dictionaries/ja';

export const dictionaries: Record<Locale, Dictionary> = { en, es, pt, fr, de, ru, tr, id, hi, ur, ar, ja };

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale];
}

export type { Dictionary };
