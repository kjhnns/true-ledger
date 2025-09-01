const UploadModal = require('../app/UploadModal').default;

test('UploadModal module loads', () => {
  expect(UploadModal).toBeDefined();
  expect(typeof UploadModal).toBe('function');
});
