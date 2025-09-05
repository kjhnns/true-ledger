import { scopeToRange, Scope } from '../lib/timeScope';

describe('scopeToRange', () => {
  it('handles month scope', () => {
    const scope: Scope = { mode: 'month', year: 2025, month: 8 };
    const { start, end } = scopeToRange(scope);
    expect(start).toBe(new Date(2025, 7, 1).getTime());
    expect(end).toBe(new Date(2025, 8, 1).getTime());
  });

  it('handles year scope', () => {
    const scope: Scope = { mode: 'year', year: 2024 };
    const { start, end } = scopeToRange(scope);
    expect(start).toBe(new Date(2024, 0, 1).getTime());
    expect(end).toBe(new Date(2025, 0, 1).getTime());
  });

  it('handles all scope', () => {
    const spy = jest.spyOn(Date, 'now').mockReturnValue(123456);
    const scope: Scope = { mode: 'all' };
    const { start, end } = scopeToRange(scope);
    expect(start).toBe(0);
    expect(end).toBe(123456);
    spy.mockRestore();
  });

  it('handles custom scope', () => {
    const scope: Scope = {
      mode: 'custom',
      startISO: '2024-01-01T00:00:00.000Z',
      endISO: '2024-01-31T00:00:00.000Z',
    };
    const { start, end } = scopeToRange(scope);
    expect(start).toBe(new Date('2024-01-01T00:00:00.000Z').getTime());
    expect(end).toBe(new Date('2024-01-31T00:00:00.000Z').getTime());
  });

  it('throws on invalid custom scope', () => {
    const scope: Scope = {
      mode: 'custom',
      startISO: '2024-02-01T00:00:00.000Z',
      endISO: '2024-01-31T00:00:00.000Z',
    };
    expect(() => scopeToRange(scope)).toThrow('start must be before end');
  });
});
