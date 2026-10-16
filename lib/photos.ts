import { getCachedSignedUrl, invalidateSignedUrl } from './signed-url-cache';
import { getCurrentUserOrThrow, getFileToken, pb } from './pocketbase';

const PHOTOS_COLLECTION = 'photos';

const MIME_TO_EXTENSION: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/gif': 'gif',
};

/**
 * Odwolanie do zdjecia zapisywane w kolumnie `photo_url` miejsc i przedmiotow
 * ma postac "{id rekordu}/{nazwa pliku}" — z niego da sie zlozyc adres pliku
 * bez dodatkowego zapytania do serwera.
 */
function parsePhotoRef(ref: string): { id: string; file: string } {
  const [id, ...rest] = ref.split('/');
  return { id, file: rest.join('/') };
}

/** Wysyla zdjecie z lokalnego URI i zwraca odwolanie do zapisania w rekordzie. */
export async function uploadPhoto(localUri: string): Promise<string> {
  const user = getCurrentUserOrThrow();

  const response = await fetch(localUri);
  const blob = await response.blob();

  // Rozszerzenie ustalamy z rzeczywistego typu pliku, nie z tekstu adresu —
  // na Web localUri ma postac "blob:http://..." i nie zawiera rozszerzenia.
  const contentType = blob.type || 'image/jpeg';
  const extension = MIME_TO_EXTENSION[contentType] ?? 'jpg';

  const form = new FormData();
  form.append('user', user.id);
  form.append('file', blob, `${Date.now()}.${extension}`);

  const record = await pb.collection(PHOTOS_COLLECTION).create(form);
  return `${record.id}/${record.file}`;
}

/** Zwraca adres do wyswietlenia zdjecia (plik jest chroniony, wiec z tokenem). */
export async function getPhotoUrl(photoRef: string): Promise<string | null> {
  return getCachedSignedUrl(photoRef, async (ref) => {
    try {
      const { id, file } = parsePhotoRef(ref);
      const token = await getFileToken();
      return pb.files.getURL({ id, collectionName: PHOTOS_COLLECTION }, file, { token });
    } catch {
      return null;
    }
  });
}

/** Usuwa zdjecia z serwera. Pojedynczy blad nie przerywa pozostalych. */
export async function removePhotos(photoRefs: string[]): Promise<void> {
  await Promise.all(
    photoRefs.map(async (ref) => {
      invalidateSignedUrl(ref);
      try {
        await pb.collection(PHOTOS_COLLECTION).delete(parsePhotoRef(ref).id);
      } catch {
        // Zdjecie moglo juz zostac usuniete — nie ma czego sprzatac.
      }
    }),
  );
}

/** Pobiera zawartosc pliku zdjecia (do eksportu danych). */
export async function downloadPhoto(photoRef: string): Promise<Blob | null> {
  const url = await getPhotoUrl(photoRef);
  if (!url) return null;

  const response = await fetch(url);
  if (!response.ok) return null;
  return response.blob();
}
