const CACHE_TTL_MS = 55 * 60 * 1000; // krotszy niz waznosc linku (1h), z zapasem

type CacheEntry = { url: string; expiresAt: number };

const cache = new Map<string, CacheEntry>();
const pending = new Map<string, Promise<string | null>>();

/**
 * Pamieta podpisane linki do zdjec w pamieci na czas trwania sesji aplikacji.
 * Bez tego kazda miniatura w galerii/liscie osobno prosi serwer o link przy
 * kazdym renderze ekranu, co przy kilkudziesieciu zdjeciach naraz (siatka)
 * tworzy lawine rownoleglych zadan sieciowych.
 *
 * `pending` chroni dodatkowo przed wyscigiem: gdy ten sam plik jest proszony
 * kilka razy zanim pierwsze zadanie wroci (typowe przy przewijaniu listy),
 * wszystkie korzystaja z jednego zadania w locie zamiast dublowac je.
 */
export async function getCachedSignedUrl(
  path: string,
  fetchFn: (path: string) => Promise<string | null>,
): Promise<string | null> {
  const cached = cache.get(path);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.url;
  }

  const inFlight = pending.get(path);
  if (inFlight) return inFlight;

  const request = fetchFn(path)
    .then((url) => {
      if (url) {
        cache.set(path, { url, expiresAt: Date.now() + CACHE_TTL_MS });
      }
      return url;
    })
    .finally(() => pending.delete(path));

  pending.set(path, request);
  return request;
}

/** Czysci wpis po podmianie/usunieciu zdjecia — inaczej cache pokazywalby stary plik. */
export function invalidateSignedUrl(path: string) {
  cache.delete(path);
  pending.delete(path);
}
