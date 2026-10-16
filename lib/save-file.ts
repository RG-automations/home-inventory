import { Platform } from 'react-native';

/**
 * Zapisuje plik i udostepnia go uzytkownikowi.
 * Na Web uruchamia pobieranie w przegladarce, na telefonie zapisuje plik
 * do pamieci podrecznej i otwiera systemowy panel udostepniania.
 */
export async function saveBlobFile(fileName: string, blob: Blob, mimeType: string) {
  if (Platform.OS === 'web') {
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
    return;
  }

  const { File, Paths } = await import('expo-file-system');
  const Sharing = await import('expo-sharing');

  const file = new File(Paths.cache, fileName);
  file.create({ overwrite: true });
  file.write(new Uint8Array(await blob.arrayBuffer()));

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, { mimeType });
  }
}
