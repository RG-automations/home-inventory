import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { authReady, pb, resetFileToken } from './pocketbase';

export type SessionUser = {
  id: string;
  email: string | undefined;
  created: string | undefined;
};

export type Session = { user: SessionUser };

type AuthContextValue = {
  session: Session | null;
  isLoading: boolean;
};

const AuthContext = createContext<AuthContextValue>({
  session: null,
  isLoading: true,
});

function readSession(): Session | null {
  const record = pb.authStore.record;
  if (!pb.authStore.isValid || !record) return null;

  return {
    user: {
      id: record.id,
      email: record.email as string | undefined,
      created: record.created as string | undefined,
    },
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const unsubscribe = pb.authStore.onChange(() => {
      if (!pb.authStore.isValid) resetFileToken();
      if (!cancelled) {
        setSession(readSession());
        setIsLoading(false);
      }
    });

    (async () => {
      await authReady;

      // Zapisany token mogl wygasnac albo konto zostalo usuniete — odswiezenie
      // go sprawdza. Brak sieci nie wylogowuje (aplikacja dziala z ostatnia sesja).
      if (pb.authStore.isValid) {
        try {
          await pb.collection('users').authRefresh();
        } catch (error) {
          const status = (error as { status?: number }).status;
          if (status === 400 || status === 401 || status === 403 || status === 404) {
            pb.authStore.clear();
          }
        }
      }

      if (!cancelled) {
        setSession(readSession());
        setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ session, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
