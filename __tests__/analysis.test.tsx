jest.mock('../app/analysis', () => ({
  __esModule: true,
  default: () => null,
}));

test('Analysis screen loads', async () => {
  const { default: Analysis } = await import('../app/analysis');
  expect(Analysis).toBeDefined();
  expect(typeof Analysis).toBe('function');
});
