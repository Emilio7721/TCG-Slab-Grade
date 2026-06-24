import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';

// Compress + resize an image URI and return base64
export async function prepareImageForUpload(uri, maxWidth = 1024) {
  const manipulated = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: maxWidth } }],
    { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG, base64: true }
  );
  return manipulated.base64;
}

// Pick the sharpest image from a list by file size (larger compressed = more detail)
export async function pickSharpest(uris) {
  if (!uris?.length) return null;
  if (uris.length === 1) return uris[0];

  const sizes = await Promise.all(
    uris.map(async uri => {
      try {
        const info = await FileSystem.getInfoAsync(uri, { size: true });
        return { uri, size: info.size ?? 0 };
      } catch {
        return { uri, size: 0 };
      }
    })
  );

  return sizes.sort((a, b) => b.size - a.size)[0].uri;
}
