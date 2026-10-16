import type { TFunction } from 'i18next';

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
    if (error.message === 'CANNOT_MOVE_INTO_ITSELF' || error.message === 'CANNOT_MOVE_INTO_OWN_SUBTREE') {
      return t('location.cannotMoveIntoOwnSubtree');
    }
    return pocketbaseDetails(error) ?? error.message;
  }

  return t(fallbackKey);
}
