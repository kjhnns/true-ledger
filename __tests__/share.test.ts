import { fileFromShareUrl } from '../lib/share';

test('fileFromShareUrl returns asset', () => {
  const asset = fileFromShareUrl('content://foo/bar/test.pdf');
  expect(asset).toEqual(
    expect.objectContaining({
      uri: 'content://foo/bar/test.pdf',
      name: 'test.pdf',
      mimeType: 'application/pdf',
    })
  );
});
