import metroConfig = require('../metro.config');

describe('metro.config', () => {
  test('includes wasm in assetExts', () => {
    const assetExts = metroConfig?.resolver?.assetExts ?? [];
    expect(assetExts).toContain('wasm');
  });
});
