import { buildRouteParams } from '../app/analysis/routeParams';

describe('buildRouteParams', () => {
  it('preserves other metric when editing income', () => {
    const params = buildRouteParams('income', ['i1', 'i2'], { savings: 's1' });
    expect(params).toEqual({ income: 'i1,i2', savings: 's1' });
  });

  it('preserves other metric when editing savings', () => {
    const params = buildRouteParams('savings', ['s2'], { income: 'i1,i2' });
    expect(params).toEqual({ income: 'i1,i2', savings: 's2' });
  });

  it('handles missing existing metrics', () => {
    const params = buildRouteParams('income', ['i1'], {});
    expect(params).toEqual({ income: 'i1' });
  });
});
