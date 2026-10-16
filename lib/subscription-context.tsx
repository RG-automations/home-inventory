import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { useAuth } from './auth-context';
import { useDataRefresh } from './data-refresh';
import {
  FREE_LIMITS,
  getProfile,
  getUsageCounts,
  isPremium,
  type Profile,
  type UsageCounts,
} from './subscription';

type SubscriptionContextValue = {
  profile: Profile | null;
  usage: UsageCounts;
  isPremiumUser: boolean;
  /** Czy uzytkownik moze dodac kolejny przedmiot (limit dotyczy tylko darmowych). */
  canAddItem: boolean;
  /** Czy uzytkownik moze dodac kolejne zdjecie. */
  canAddPhoto: boolean;
  isLoading: boolean;
};

const EMPTY_USAGE: UsageCounts = { items: 0, photos: 0 };

const SubscriptionContext = createContext<SubscriptionContextValue>({
  profile: null,
  usage: EMPTY_USAGE,
  isPremiumUser: false,
  canAddItem: true,
  canAddPhoto: true,
  isLoading: true,
});

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const { subscribe } = useDataRefresh();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [usage, setUsage] = useState<UsageCounts>(EMPTY_USAGE);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    if (!session) {
      setProfile(null);
      setUsage(EMPTY_USAGE);
      setIsLoading(false);
      return;
    }

    try {
      const [loadedProfile, loadedUsage] = await Promise.all([getProfile(), getUsageCounts()]);
      setProfile(loadedProfile);
      setUsage(loadedUsage);
    } finally {
      setIsLoading(false);
    }
  }, [session]);

  useEffect(() => {
    load();
  }, [load]);

  // Po dodaniu/usunieciu przedmiotu liczniki musza sie przeliczyc.
  useEffect(() => subscribe(load), [subscribe, load]);

  const isPremiumUser = isPremium(profile);

  return (
    <SubscriptionContext.Provider
      value={{
        profile,
        usage,
        isPremiumUser,
        canAddItem: isPremiumUser || usage.items < FREE_LIMITS.items,
        canAddPhoto: isPremiumUser || usage.photos < FREE_LIMITS.photos,
        isLoading,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  return useContext(SubscriptionContext);
}
