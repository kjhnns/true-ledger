import type * as DocumentPicker from 'expo-document-picker';

export function fileFromShareUrl(url: string): DocumentPicker.DocumentPickerAsset {
  const name = decodeURIComponent(url.split('/').pop()?.split('?')[0] ?? 'shared.pdf');
  return {
    uri: url,
    name,
    mimeType: 'application/pdf',
  } as DocumentPicker.DocumentPickerAsset;
}
