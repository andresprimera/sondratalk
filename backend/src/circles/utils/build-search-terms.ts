import { LOCALE_KEYS } from '@base-dashboard/shared';

type Labels = Record<string, string>;
type Aliases = Record<string, string[]>;

export function normalize(input: string): string {
  return input
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

export function buildSearchTerms(
  labels: Labels,
  aliases?: Aliases,
): string[] {
  const terms = new Set<string>();
  for (const locale of LOCALE_KEYS) {
    const label = labels[locale];
    if (label) {
      const n = normalize(label);
      if (n) terms.add(n);
    }
    const list = aliases?.[locale] ?? [];
    for (const a of list) {
      if (a) {
        const n = normalize(a);
        if (n) terms.add(n);
      }
    }
  }
  return Array.from(terms);
}
