import type { Dictionary } from '@/i18n/types';

/** The part of the dictionary the calculator needs in the browser. */
export type Ui = Pick<
  Dictionary,
  'form' | 'progress' | 'errors' | 'results' | 'planner' | 'list' | 'actions' | 'csv' | 'units' | 'plurals'
>;
