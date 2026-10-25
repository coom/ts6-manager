import { describe, it, expect } from 'vitest';
import { filterRegularServerGroups } from './server-group-filter.js';

describe('filterRegularServerGroups', () => {
  const list = [
    { sgid: '1', name: 'Guest Server Query', type: '2' },
    { sgid: '2', name: 'Admin Server Query', type: '2' },
    { sgid: '3', name: 'Server Admin', type: '0' },
    { sgid: '4', name: 'Normal', type: '0' },
    { sgid: '6', name: 'Server Admin', type: '1' },
    { sgid: '7', name: 'Normal', type: 1 },
  ];

  it('ne garde que les groupes réguliers (type 1), templates et query exclus', () => {
    expect(filterRegularServerGroups(list).map((g: any) => g.sgid)).toEqual(['6', '7']);
  });

  it('garde une entrée sans champ type (réponse inattendue → permissif)', () => {
    expect(filterRegularServerGroups([{ sgid: '9', name: 'X' }])).toHaveLength(1);
  });

  it('retourne [] sur une réponse non-tableau', () => {
    expect(filterRegularServerGroups({ error: 'x' })).toEqual([]);
  });
});
