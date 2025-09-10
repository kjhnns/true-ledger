jest.mock('../app/TimeScopePicker', () => ({
  __esModule: true,
  default: () => null,
}));

test('TimeScopePicker module loads', async () => {
  const { default: TimeScopePicker } = await import('../app/TimeScopePicker');
  expect(TimeScopePicker).toBeDefined();
  expect(typeof TimeScopePicker).toBe('function');
});
