import { getCurrentUserOrThrow, pb } from './pocketbase';

export type Tier = 'free' | 'premium' | 'lifetime';

export type Profile = {
  id: string;
  tier: Tier;
  subscription_expires_at: string | null;
  created_at: string;
};

/** Limity dla darmowego poziomu (model freemium). */
export const FREE_LIMITS = {
  items: 50,
  photos: 10,
} as const;

/**
 * Status subskrypcji to pola `tier` i `subscription_expires_at` w kolekcji users.
 * Uzytkownik nie moze ich zmienic (regula update w pocketbase/pb_migrations) —
 * robi to wylacznie backend jako superuser.
 */
export async function getProfile(): Promise<Profile | null> {
  if (!pb.authStore.isValid || !pb.authStore.record) return null;

  // Swiezy odczyt z serwera: status mogl sie zmienic od chwili logowania.
  const record = await pb.collection('users').getOne(pb.authStore.record.id);

  return {
    id: record.id,
    tier: (record.tier || 'free') as Tier,
    subscription_expires_at: record.subscription_expires_at || null,
    created_at: record.created,
  };
}

/** Czy uzytkownik ma aktywny dostep premium (subskrypcja lub dozywotni). */
export function isPremium(profile: Profile | null): boolean {
  if (!profile) return false;
  if (profile.tier === 'lifetime') return true;
  if (profile.tier !== 'premium') return false;

  // Subskrypcja bez daty wygasniecia traktowana jako aktywna
  // (np. dopiero co oplacona, webhook jeszcze nie ustawil daty).
  if (!profile.subscription_expires_at) return true;

  return new Date(profile.subscription_expires_at) > new Date();
}

export type UsageCounts = {
  items: number;
  photos: number;
};

async function countRecords(collection: string, filter?: string): Promise<number> {
  const result = await pb.collection(collection).getList(1, 1, {
    filter,
    fields: 'id',
    // Parallel counts hit the same endpoint; without this PocketBase auto-cancels all but the last.
    requestKey: null,
  });
  return result.totalItems;
}

export async function getUsageCounts(): Promise<UsageCounts> {
  getCurrentUserOrThrow();

  const [items, itemPhotos, locationPhotos] = await Promise.all([
    countRecords('items'),
    countRecords('items', 'photo_url != ""'),
    countRecords('locations', 'photo_url != ""'),
  ]);

  return { items, photos: itemPhotos + locationPhotos };
}
