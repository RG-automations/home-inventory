import { getCurrentUserOrThrow, pb } from './pocketbase';
import { getPhotoUrl, removePhotos, uploadPhoto } from './photos';
import { invalidateSignedUrl } from './signed-url-cache';

export type Location = {
  id: string;
  user_id: string;
  parent_id: string | null;
  name: string;
  photo_url: string | null;
  created_at: string;
};

export type Item = {
  id: string;
  user_id: string;
  location_id: string;
  name: string;
  description: string | null;
  photo_url: string | null;
  created_at: string;
};

// PocketBase zwraca puste pola jako "" — aplikacja oczekuje null.
type RawRecord = Record<string, any>;

export function toLocation(record: RawRecord): Location {
  return {
    id: record.id,
    user_id: record.user_id,
    parent_id: record.parent_id || null,
    name: record.name,
    photo_url: record.photo_url || null,
    created_at: record.created_at,
  };
}

export function toItem(record: RawRecord): Item {
  return {
    id: record.id,
    user_id: record.user_id,
    location_id: record.location_id,
    name: record.name,
    description: record.description || null,
    photo_url: record.photo_url || null,
    created_at: record.created_at,
  };
}

/** Polskie znaki liczy sie wg alfabetu, a nie wg kodow znakow (Ż po Z, a nie po wszystkim). */
export function compareByName(a: { name: string }, b: { name: string }) {
  return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
}

export async function getChildLocations(parentId: string | null) {
  const records = await pb.collection('locations').getFullList({
    filter: pb.filter('parent_id = {:parentId}', { parentId: parentId ?? '' }),
  });
  return records.map(toLocation).sort(compareByName);
}

export async function getItemsInLocation(locationId: string) {
  const records = await pb.collection('items').getFullList({
    filter: pb.filter('location_id = {:locationId}', { locationId }),
  });
  return records.map(toItem).sort(compareByName);
}

export async function getLocationById(id: string) {
  const record = await pb.collection('locations').getOne(id);
  return toLocation(record);
}

export async function createLocation(name: string, parentId: string | null) {
  const user = getCurrentUserOrThrow();

  const record = await pb.collection('locations').create({
    name,
    parent_id: parentId ?? '',
    user_id: user.id,
    created_at: new Date().toISOString(),
  });

  return toLocation(record);
}

/** Zbiera id tego miejsca i wszystkich jego potomkow (cale poddrzewo). */
export async function collectSubtreeIds(rootId: string): Promise<string[]> {
  const data = await pb.collection('locations').getFullList({ fields: 'id,parent_id' });

  const childrenByParent = new Map<string, string[]>();
  for (const row of data) {
    if (!row.parent_id) continue;
    const siblings = childrenByParent.get(row.parent_id) ?? [];
    siblings.push(row.id);
    childrenByParent.set(row.parent_id, siblings);
  }

  const collected: string[] = [];
  const visited = new Set<string>();
  const queue = [rootId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);
    collected.push(current);
    queue.push(...(childrenByParent.get(current) ?? []));
  }

  return collected;
}

export async function deleteLocation(id: string) {
  // Baza kasuje kaskadowo podmiejsca i przedmioty, ale NIE zdjecia (to osobne
  // rekordy) — trzeba je usunac recznie po skasowaniu miejsca, inaczej zostaja jako smieci.
  const subtreeIds = new Set(await collectSubtreeIds(id));

  const [itemRows, locationRows] = await Promise.all([
    pb.collection('items').getFullList({
      filter: 'photo_url != ""',
      fields: 'location_id,photo_url',
    }),
    pb.collection('locations').getFullList({
      filter: 'photo_url != ""',
      fields: 'id,photo_url',
    }),
  ]);

  const photoRefs = [
    ...itemRows.filter((row) => subtreeIds.has(row.location_id)).map((row) => row.photo_url as string),
    ...locationRows.filter((row) => subtreeIds.has(row.id)).map((row) => row.photo_url as string),
  ];

  await pb.collection('locations').delete(id);

  if (photoRefs.length > 0) {
    await removePhotos(photoRefs);
  }
}

/**
 * Przenosi miejsce (wraz z cala zawartoscia — podmiejsca i przedmioty)
 * pod innego rodzica. newParentId = null oznacza korzen ("Wszystkie miejsca").
 */
export async function moveLocation(id: string, newParentId: string | null) {
  if (newParentId === id) {
    throw new Error('CANNOT_MOVE_INTO_ITSELF');
  }

  if (newParentId) {
    // Nie mozna przeniesc miejsca do wlasnego poddrzewa (np. skrzyni
    // wsadzic do pudelka, ktore w niej lezy) — to stworzyloby cykl.
    const subtreeIds = await collectSubtreeIds(id);
    if (subtreeIds.includes(newParentId)) {
      throw new Error('CANNOT_MOVE_INTO_OWN_SUBTREE');
    }
  }

  await pb.collection('locations').update(id, { parent_id: newParentId ?? '' });
}

export async function uploadLocationPhoto(localUri: string): Promise<string> {
  // Zdjecia miejsc i przedmiotow trafiaja do tej samej kolekcji "photos".
  return uploadPhoto(localUri);
}

export async function getLocationPhotoUrl(photoRef: string): Promise<string | null> {
  return getPhotoUrl(photoRef);
}

export async function updateLocation(params: {
  id: string;
  name: string;
  photoUrl: string | null;
  oldPhotoPathToDelete: string | null;
}) {
  await pb.collection('locations').update(params.id, {
    name: params.name,
    photo_url: params.photoUrl ?? '',
  });

  if (params.oldPhotoPathToDelete) {
    invalidateSignedUrl(params.oldPhotoPathToDelete);
    await removePhotos([params.oldPhotoPathToDelete]);
  }
}

export async function locationHasContent(id: string) {
  const [children, items] = await Promise.all([
    pb.collection('locations').getList(1, 1, {
      filter: pb.filter('parent_id = {:id}', { id }),
      fields: 'id',
    }),
    pb.collection('items').getList(1, 1, {
      filter: pb.filter('location_id = {:id}', { id }),
      fields: 'id',
    }),
  ]);

  return children.totalItems + items.totalItems > 0;
}

export async function getLocationPath(id: string) {
  const path: Location[] = [];
  const visited = new Set<string>();
  let currentId: string | null = id;

  while (currentId) {
    // Zabezpieczenie przed cyklem w hierarchii (uszkodzone dane) —
    // bez tego petla nigdy by sie nie zakonczyla.
    if (visited.has(currentId)) break;
    visited.add(currentId);

    const location = await getLocationById(currentId);
    path.unshift(location);
    currentId = location.parent_id;
  }

  return path;
}

export type ItemSearchResult = Item & { locationPath: Location[] };

/** Formatuje sciezke lokalizacji do wyswietlenia, np. "Garaz › Regal 2 › Skrzynia". */
export function formatLocationPath(path: Location[]): string {
  return path.map((location) => location.name).join(' › ');
}

async function withLocationPaths(items: Item[]): Promise<ItemSearchResult[]> {
  if (items.length === 0) return [];

  // Jedno zapytanie po wszystkie miejsca zamiast osobnego lancucha zapytan
  // na kazdy przedmiot (wczesniej: N przedmiotow x D poziomow zagniezdzenia).
  const data = await pb.collection('locations').getFullList();

  const locationById = new Map<string, Location>();
  for (const record of data) {
    const location = toLocation(record);
    locationById.set(location.id, location);
  }

  const pathCache = new Map<string, Location[]>();

  function buildPath(locationId: string): Location[] {
    const cached = pathCache.get(locationId);
    if (cached) return cached;

    const path: Location[] = [];
    const visited = new Set<string>();
    let currentId: string | null = locationId;

    while (currentId && !visited.has(currentId)) {
      visited.add(currentId);
      const location = locationById.get(currentId);
      if (!location) break;
      path.unshift(location);
      currentId = location.parent_id;
    }

    pathCache.set(locationId, path);
    return path;
  }

  return items.map((item) => ({ ...item, locationPath: buildPath(item.location_id) }));
}

export async function searchItems(query: string): Promise<ItemSearchResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  // Operator "~" w SQLite ignoruje wielkosc tylko dla liter ASCII, wiec "zarowka"
  // znajdzie "Zarowka", ale "żarówka" nie znalazloby "Żarówka". Szukamy wiec
  // kilku wariantow wielkosci liter naraz.
  const variants = [
    ...new Set([
      trimmed,
      trimmed.toLowerCase(),
      trimmed.toUpperCase(),
      trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase(),
    ]),
  ];
  const params: Record<string, string> = {};
  const filter = variants
    .map((variant, index) => {
      params[`q${index}`] = variant;
      return `name ~ {:q${index}}`;
    })
    .join(' || ');

  const result = await pb.collection('items').getList(1, 30, {
    filter: pb.filter(filter, params),
  });

  return withLocationPaths(result.items.map(toItem).sort(compareByName));
}

export type ItemSortBy = 'name' | 'newest';

export async function getAllItems(sortBy: ItemSortBy): Promise<ItemSearchResult[]> {
  const records = await pb.collection('items').getFullList(
    sortBy === 'newest' ? { sort: '-created_at' } : {},
  );

  const items = records.map(toItem);
  if (sortBy === 'name') items.sort(compareByName);

  return withLocationPaths(items);
}

export type LocationTreeNode = Location & {
  children: LocationTreeNode[];
  itemCount: number;
};

export async function getLocationTree(): Promise<LocationTreeNode[]> {
  const [locationRecords, itemRecords] = await Promise.all([
    pb.collection('locations').getFullList(),
    pb.collection('items').getFullList({ fields: 'location_id' }),
  ]);

  const locations = locationRecords.map(toLocation).sort(compareByName);

  const itemCounts = new Map<string, number>();
  for (const item of itemRecords) {
    itemCounts.set(item.location_id, (itemCounts.get(item.location_id) ?? 0) + 1);
  }

  const nodeById = new Map<string, LocationTreeNode>();
  for (const location of locations) {
    nodeById.set(location.id, {
      ...location,
      children: [],
      itemCount: itemCounts.get(location.id) ?? 0,
    });
  }

  const roots: LocationTreeNode[] = [];
  for (const node of nodeById.values()) {
    if (node.parent_id && nodeById.has(node.parent_id)) {
      nodeById.get(node.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}
