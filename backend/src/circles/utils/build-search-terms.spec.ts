import { buildSearchTerms, normalize } from './build-search-terms';

describe('buildSearchTerms', () => {
  it('builds normalized terms from labels and aliases across locales', () => {
    const result = buildSearchTerms(
      { en: 'German Shepherd', es: 'Pastor Alemán' },
      { en: ['GSD'], es: [] },
    );

    expect(result).toEqual(
      expect.arrayContaining(['german shepherd', 'gsd', 'pastor aleman']),
    );
    expect(result).toHaveLength(3);
  });

  it('handles missing aliases', () => {
    const result = buildSearchTerms({ en: 'Cars', es: 'Autos' });
    expect(result).toEqual(['cars', 'autos']);
  });

  it('dedupes terms that collapse after normalization', () => {
    const result = buildSearchTerms(
      { en: 'Café', es: 'Café' },
      { en: ['CAFE'], es: ['cafe'] },
    );
    expect(result).toEqual(['cafe']);
  });

  it('strips Spanish accents', () => {
    const result = buildSearchTerms(
      { en: 'spanish', es: 'áéíóúñ' },
      { en: [], es: [] },
    );
    expect(result).toContain('aeioun');
  });

  it('drops empty strings', () => {
    const result = buildSearchTerms(
      { en: 'Dogs', es: 'Perros' },
      { en: ['', '   '], es: [''] },
    );
    expect(result).toEqual(['dogs', 'perros']);
  });
});

describe('normalize', () => {
  it('lowercases, trims, and strips diacritics', () => {
    expect(normalize('  Pastor Alemán  ')).toBe('pastor aleman');
  });

  it('returns empty string for whitespace-only input', () => {
    expect(normalize('   ')).toBe('');
  });
});
