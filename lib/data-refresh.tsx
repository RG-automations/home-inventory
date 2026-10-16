import { createContext, useCallback, useContext, useRef, type ReactNode } from 'react';

type DataRefreshContextValue = {
  notifyChanged: () => void;
  subscribe: (listener: () => void) => () => void;
};

const DataRefreshContext = createContext<DataRefreshContextValue>({
  notifyChanged: () => {},
  subscribe: () => () => {},
});

export function DataRefreshProvider({ children }: { children: ReactNode }) {
  const listeners = useRef(new Set<() => void>());

  const notifyChanged = useCallback(() => {
    listeners.current.forEach((listener) => listener());
  }, []);

  const subscribe = useCallback((listener: () => void) => {
    listeners.current.add(listener);
    return () => listeners.current.delete(listener);
  }, []);

  return (
    <DataRefreshContext.Provider value={{ notifyChanged, subscribe }}>
      {children}
    </DataRefreshContext.Provider>
  );
}

export function useDataRefresh() {
  return useContext(DataRefreshContext);
}
