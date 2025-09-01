jest.mock('../app/UploadModal', () => ({
  __esModule: true,
  default: () => null,
}));

test('UploadModal module loads', async () => {
  const { default: UploadModal } = await import('../app/UploadModal');
  expect(UploadModal).toBeDefined();
  expect(typeof UploadModal).toBe('function');
});
