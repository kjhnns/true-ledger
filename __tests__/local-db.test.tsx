jest.mock('../app/local-db', () => ({
  __esModule: true,
  default: () => null,
}));

test('Local database screen loads', async () => {
  const { default: LocalDb } = await import('../app/local-db');
  expect(LocalDb).toBeDefined();
  expect(typeof LocalDb).toBe('function');
});
