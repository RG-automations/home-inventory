import JSZip from 'jszip';
import { getCurrentUserOrThrow, pb } from './pocketbase';
import { toItem, toLocation, type Item, type Location } from './locations';
import { downloadPhoto } from './photos';

export type ExportedData = {
  exportedAt: string;
  account: {
    id: string;
    email: string | undefined;
    createdAt: string | undefined;
  };
  locations: (Location & {
    /** Nazwa pliku w folderze "zdjecia/" wewnatrz archiwum (null gdy brak zdjecia). */
    photoFile: string | null;
  })[];
  items: (Item & {
    /** Nazwa pliku w folderze "zdjecia/" wewnatrz archiwum (null gdy brak zdjecia). */
    photoFile: string | null;
  })[];
};

/** Zamienia nazwe przedmiotu na bezpieczna nazwe pliku. */
function toSafeFileName(name: string): string {
  return name
    .replace(/[^\p{L}\p{N}\s._-]/gu, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 60) || 'przedmiot';
}

/**
 * Zbiera wszystkie dane uzytkownika (RODO art. 15 i 20 — prawo dostepu
 * i przenoszenia danych).
 */
export async function exportUserData(): Promise<ExportedData> {
  const user = getCurrentUserOrThrow();

  const [locations, items] = await Promise.all([
    pb.collection('locations').getFullList({ sort: 'created_at' }),
    pb.collection('items').getFullList({ sort: 'created_at' }),
  ]);

  const typedLocations = locations.map(toLocation);
  const typedItems = items.map(toItem);

  return {
    exportedAt: new Date().toISOString(),
    account: {
      id: user.id,
      email: user.email as string | undefined,
      createdAt: user.created as string | undefined,
    },
    locations: typedLocations.map((location) => ({
      ...location,
      photoFile: location.photo_url ? buildPhotoFileName(location.name, location.id, location.photo_url) : null,
    })),
    items: typedItems.map((item) => ({
      ...item,
      photoFile: item.photo_url ? buildPhotoFileName(item.name, item.id, item.photo_url) : null,
    })),
  };
}

function buildPhotoFileName(name: string, id: string, photoUrl: string): string {
  const extension = photoUrl.split('/').pop()?.split('.').pop()?.match(/^[a-z0-9]+$/i)?.[0] ?? 'jpg';
  return `${toSafeFileName(name)}-${id.slice(0, 8)}.${extension}`;
}

export type ExportProgress = {
  downloadedPhotos: number;
  totalPhotos: number;
};

/**
 * Buduje archiwum ZIP z danymi uzytkownika: dane.json + folder zdjecia/
 * z rzeczywistymi plikami. Zwraca gotowe archiwum jako Blob.
 */
export async function buildExportArchive(
  onProgress?: (progress: ExportProgress) => void,
): Promise<Blob> {
  const data = await exportUserData();
  const zip = new JSZip();

  zip.file('dane.json', JSON.stringify(data, null, 2));

  const itemsWithPhotos = data.items.filter((item) => item.photo_url && item.photoFile);
  const locationsWithPhotos = data.locations.filter((loc) => loc.photo_url && loc.photoFile);
  const allPhotos = [...itemsWithPhotos, ...locationsWithPhotos];
  const photosFolder = zip.folder('zdjecia');

  let downloaded = 0;
  onProgress?.({ downloadedPhotos: 0, totalPhotos: allPhotos.length });

  for (const entry of allPhotos) {
    // Pojedyncze nieudane zdjecie nie moze przerwac calego eksportu.
    try {
      const fileData = await downloadPhoto(entry.photo_url as string);
      if (fileData) {
        photosFolder?.file(entry.photoFile as string, fileData);
      }
    } catch {
      // pomijamy to zdjecie
    }

    downloaded += 1;
    onProgress?.({ downloadedPhotos: downloaded, totalPhotos: allPhotos.length });
  }

  return zip.generateAsync({ type: 'blob' });
}

/**
 * Trwale usuwa wszystkie dane uzytkownika (RODO art. 17 — prawo do bycia zapomnianym).
 *
 * Konto (e-mail) zostaje — kolekcja users pozwala uzytkownikowi usunac samego
 * siebie, ale to osobna decyzja produktowa (wylogowuje i kasuje konto).
 */
export async function deleteAllUserData(): Promise<void> {
  const user = getCurrentUserOrThrow();

  // Miejsca kasuja kaskadowo podmiejsca i przedmioty. Zdjecia to osobne rekordy,
  // wiec usuwamy wszystkie zdjecia uzytkownika, takze ewentualne osierocone.
  const [photos, rootLocations] = await Promise.all([
    pb.collection('photos').getFullList({ fields: 'id' }),
    pb.collection('locations').getFullList({
      filter: 'parent_id = ""',
      fields: 'id',
    }),
  ]);

  for (const location of rootLocations) {
    await pb.collection('locations').delete(location.id);
  }

  // Przedmioty bez waznego miejsca nie istnieja (location_id jest wymagane), ale
  // dla pewnosci sprzatamy to, co mogloby zostac.
  const leftovers = await pb.collection('items').getFullList({
    filter: pb.filter('user_id = {:id}', { id: user.id }),
    fields: 'id',
  });
  for (const item of leftovers) {
    await pb.collection('items').delete(item.id);
  }

  for (const photo of photos) {
    await pb.collection('photos').delete(photo.id);
  }
}
