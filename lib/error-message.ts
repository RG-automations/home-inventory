import type { TFunction } from 'i18next';
import { FREE_LIMITS } from './subscription';

/** PocketBase kryje szczegoly (np. "Failed to create record") w `response.data` — wyciagamy je. */
function pocketbaseDetails(error: unknown): string | null {
  const data = (error as { response?: { data?: Record<string, { message?: string }> } })?.response?.data;
  if (!data || typeof data !== 'object') return null;

  const messages = Object.entries(data)
    .map(([field, detail]) => (detail?.message ? `${field}: ${detail.message}` : null))
    .filter((message): message is string => Boolean(message));

  return messages.length > 0 ? messages.join(', ') : null;
}

/**
 * Zamienia blad na komunikat dla uzytkownika.
 * Wlasne kody bledow aplikacji sa tlumaczone, komunikaty z PocketBase
 * przekazywane sa bez zmian (sa po angielsku, ale konkretne).
 */
export function describeError(error: unknown, t: TFunction, fallbackKey: string): string {
  if (error instanceof Error) {
    if (error.message === 'NOT_AUTHENTICATED') {
      return t('common.notAuthenticated');
    }
    // Server-side free-tier limit (pocketbase/pb_hooks/free_limits.pb.js).
    if (error.message === 'FREE_LIMIT_ITEMS') {
      return t('upgrade.itemsLimitReached', { limit: FREE_LIMITS.items });
    }
    if (error.message === 'FREE_LIMIT_PHOTOS') {
      return t('upgrade.photosLimitReached', { limit: FREE_LIMITS.photos });
    }
    if (error.message === 'CANNOT_MOVE_INTO_ITSELF' || error.message === 'CANNOT_MOVE_INTO_OWN_SUBTREE') {
      return t('location.cannotMoveIntoOwnSubtree');
    }
    return pocketbaseDetails(error) ?? error.message;
  }

  return t(fallbackKey);
}
