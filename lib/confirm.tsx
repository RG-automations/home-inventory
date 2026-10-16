import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { Alert, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

type ConfirmOptions = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string | null;
};

type ConfirmContextValue = {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  alertInfo: (title: string, message: string) => Promise<void>;
};

const ConfirmContext = createContext<ConfirmContextValue>({
  confirm: () => Promise.resolve(false),
  alertInfo: () => Promise.resolve(),
});

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<
    (ConfirmOptions & { resolve: (value: boolean) => void }) | null
  >(null);

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    if (Platform.OS !== 'web') {
      return new Promise((resolve) => {
        const buttons =
          options.cancelLabel === null
            ? [{ text: options.confirmLabel ?? 'OK', onPress: () => resolve(true) }]
            : [
                { text: options.cancelLabel ?? 'Anuluj', style: 'cancel' as const, onPress: () => resolve(false) },
                {
                  text: options.confirmLabel ?? 'Usun',
                  style: 'destructive' as const,
                  onPress: () => resolve(true),
                },
              ];
        Alert.alert(options.title, options.message, buttons);
      });
    }

    return new Promise((resolve) => {
      setRequest({ ...options, resolve });
    });
  }, []);

  const alertInfo = useCallback(
    (title: string, message: string) =>
      confirm({ title, message, confirmLabel: 'OK', cancelLabel: null }).then(() => undefined),
    [confirm],
  );

  function handleClose(result: boolean) {
    request?.resolve(result);
    setRequest(null);
  }

  const showCancel = request?.cancelLabel !== null;

  return (
    <ConfirmContext.Provider value={{ confirm, alertInfo }}>
      {children}
      <Modal visible={request !== null} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={styles.card}>
            <Text style={styles.title}>{request?.title}</Text>
            <Text style={styles.message}>{request?.message}</Text>
            <View style={styles.actions}>
              {showCancel && (
                <Pressable style={styles.cancelButton} onPress={() => handleClose(false)}>
                  <Text>{request?.cancelLabel ?? 'Anuluj'}</Text>
                </Pressable>
              )}
              <Pressable style={styles.confirmButton} onPress={() => handleClose(true)}>
                <Text style={styles.confirmButtonText}>
                  {request?.confirmLabel ?? 'Usun'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  return useContext(ConfirmContext).confirm;
}

export function useAlertInfo() {
  return useContext(ConfirmContext).alertInfo;
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    width: '85%',
    maxWidth: 400,
  },
  title: { fontSize: 17, fontWeight: '600', marginBottom: 8 },
  message: { fontSize: 15, color: '#444' },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 20,
    gap: 12,
  },
  cancelButton: { padding: 10 },
  confirmButton: {
    backgroundColor: '#dc2626',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  confirmButtonText: { color: '#fff', fontWeight: '600' },
});
