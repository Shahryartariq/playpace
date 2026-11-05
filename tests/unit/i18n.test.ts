import { describe, expect, it } from 'vitest';
import { locales } from '@/i18n/config';
import type { Dictionary } from '@/i18n/types';
import en from '@/i18n/dictionaries/en';

const modules = import.meta.glob<{ default: Dictionary }>('../../src/i18n/dictionaries/*.ts', { eager: true });
const byLocale = Object.fromEntries(
  Object.entries(modules).map(([path, mod]) => [path.split('/').pop()!.replace('.ts', ''), mod.default]),
);

const PLURAL_KEYS = new Set(['zero', 'one', 'two', 'few', 'many', 'other']);

function isPlural(value: unknown): value is Record<string, string> {
  return !!value && typeof value === 'object' && !Array.isArray(value) && 'other' in value &&
    Object.keys(value).every((k) => PLURAL_KEYS.has(k));
}

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

/** Walks the English dictionary and checks the same path in `other`. */
function compare(base: unknown, other: unknown, path: string, problems: string[]) {
  if (isPlural(base)) {
    if (!isPlural(other)) return void problems.push(`${path}: expected plural forms`);
    for (const [form, text] of Object.entries(other)) {
      if (!text.includes('{n}')) problems.push(`${path}.${form}: missing {n}`);
    }
    return;
  }
  if (typeof base === 'string') {
    if (typeof other !== 'string') return void problems.push(`${path}: expected text`);
    if (path !== 'units.unitGap' && path !== 'units.partGap' && !other.trim()) problems.push(`${path}: empty`);
    const a = placeholders(base).join(',');
    const b = placeholders(other).join(',');
    if (a !== b) problems.push(`${path}: placeholders {${a}} vs {${b}}`);
    return;
  }
  if (Array.isArray(base)) {
    if (!Array.isArray(other) || other.length !== base.length) {
      return void problems.push(`${path}: expected ${base.length} items`);
    }
    base.forEach((item, i) => compare(item, other[i], `${path}[${i}]`, problems));
    return;
  }
  if (base && typeof base === 'object') {
    if (!other || typeof other !== 'object') return void problems.push(`${path}: expected object`);
    const extra = Object.keys(other).filter((k) => !(k in base));
    if (extra.length) problems.push(`${path}: unknown keys ${extra.join(', ')}`);
    for (const [key, value] of Object.entries(base)) compare(value, (other as Record<string, unknown>)[key], path ? `${path}.${key}` : key, problems);
  }
}

describe('dictionaries', () => {
  it('has a file for every locale', () => {
    expect(Object.keys(byLocale).sort()).toEqual([...locales].sort());
  });

  for (const [code, dict] of Object.entries(byLocale)) {
    it(`${code} matches the English structure and placeholders`, () => {
      const problems: string[] = [];
      compare(en, dict, '', problems);
      expect(problems).toEqual([]);
    });

    it(`${code} keeps titles and descriptions a sensible length`, () => {
      expect(dict.meta.title.length).toBeLessThanOrEqual(75);
      expect(dict.meta.description.length).toBeGreaterThan(80);
      // Google shows about 160 characters of a description; keep every page within that.
      expect([...dict.meta.description].length).toBeLessThanOrEqual(160);
      expect([...dict.meta.speedDescription].length).toBeLessThanOrEqual(160);
      expect([...dict.meta.privacyDescription].length).toBeLessThanOrEqual(160);
      expect(dict.meta.speedTitle.length).toBeLessThanOrEqual(75);
    });

    if (code !== 'en') {
      it(`${code} is actually translated`, () => {
        expect(dict.hero.h1).not.toBe(en.hero.h1);
        expect(dict.content.faq[0]!.a).not.toBe(en.content.faq[0]!.a);
        expect(dict.privacy.sections[0]!.paragraphs[0]).not.toBe(en.privacy.sections[0]!.paragraphs[0]);
      });
    }
  }
});
