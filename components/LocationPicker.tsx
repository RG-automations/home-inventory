import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import AnimatedPressable from './AnimatedPressable';
import LocationBreadcrumb from './LocationBreadcrumb';
import LocationThumbnail from './LocationThumbnail';
import { useDataRefresh } from '../lib/data-refresh';
import { DRAWER_TIMING } from '../lib/drawer-motion';
import { createLocation, getChildLocations, getLocationPath, type Location } from '../lib/locations';
import type { Theme } from '../lib/theme';
import { useTheme } from '../lib/theme-context';
import { useReducedMotion } from '../lib/use-reduced-motion';

type Props = {
  visible: boolean;
  onClose: () => void;
  onSelect: (location: Location) => void;
  /**
   * Id miejsc niedostepnych do wyboru (np. przenoszone miejsce i cale jego
   * poddrzewo — nie mozna wsadzic skrzyni do niej samej ani do jej zawartosci).
   */
  excludeIds?: string[];
  /**
   * Pozwala wybrac poziom glowny ("Wszystkie miejsca") jako cel — potrzebne
   * przy przenoszeniu miejsca, gdzie root jest prawidlowym celem (parent_id = null).
   * Przy dodawaniu przedmiotu nie ma to sensu, bo przedmiot zawsze nalezy
   * do jakiegos miejsca.
   */
  allowRoot?: boolean;
  onSelectRoot?: () => void;
};

export default function LocationPicker({
  visible,
  onClose,
  onSelect,
  excludeIds,
  allowRoot,
  onSelectRoot,
}: Props) {
  const { t } = useTranslation();
  const { notifyChanged } = useDataRefresh();
  const theme = useTheme();
  const isReducedMotion = useReducedMotion();
  const { height } = useWindowDimensions();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [path, setPath] = useState<Location[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    const [childLocations, breadcrumb] = await Promise.all([
      getChildLocations(currentId),
      currentId ? getLocationPath(currentId) : Promise.resolve([]),
    ]);
    const visibleLocations = excludeIds
      ? childLocations.filter((loc) => !excludeIds.includes(loc.id))
      : childLocations;
    setLocations(visibleLocations);
    setPath(breadcrumb);
    setIsLoading(false);
  }, [currentId, excludeIds]);

  useEffect(() => {
    if (visible) loadData();
  }, [visible, loadData]);

  useEffect(() => {
    if (!visible) {
      setCurrentId(null);
      setIsAdding(false);
      setNewName('');
    }
  }, [visible]);

  async function handleCreateLocation() {
    if (!newName.trim()) return;
    setIsSaving(true);
    const created = await createLocation(newName.trim(), currentId);
    setIsSaving(false);
    setNewName('');
    setIsAdding(false);
    notifyChanged();
    onSelect(created);
  }

  const currentLocation = path[path.length - 1] ?? null;

  // Ten arkusz ma inny ksztalt niz pelnoekranowe modale (BottomSheetModal) —
  // czesciowa wysokosc (maxHeight 80%) zakotwiczona do dolu, nie flex: 1 —
  // wiec animacja wjazdu jest tu wlasna, ale uzywa tej samej krzywej/czasu
  // (DRAWER_TIMING) dla spojnosci z pozostalymi arkuszami w apce.
  const translateY = useSharedValue(height);
  useEffect(() => {
    const target = visible ? 0 : height;
    translateY.value = isReducedMotion ? target : withTiming(target, DRAWER_TIMING);
  }, [visible, height, isReducedMotion, translateY]);

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Animated.View style={[styles.sheet, sheetStyle]}>
          <View style={styles.header}>
            <Text style={styles.title}>{t('location.choose')}</Text>
            <AnimatedPressable onPress={onClose}>
              <Text style={styles.closeText}>{t('common.close')}</Text>
            </AnimatedPressable>
          </View>

          <View style={styles.breadcrumbContainer}>
            <LocationBreadcrumb path={path} onNavigate={setCurrentId} />
          </View>

          {currentLocation ? (
            <AnimatedPressable
              style={styles.selectCurrentButton}
              onPress={() => onSelect(currentLocation)}
            >
              <Text style={styles.selectCurrentText}>
                {t('location.placeHere', { name: currentLocation.name })}
              </Text>
            </AnimatedPressable>
          ) : (
            allowRoot &&
            onSelectRoot && (
              <AnimatedPressable style={styles.selectCurrentButton} onPress={onSelectRoot}>
                <Text style={styles.selectCurrentText}>
                  {t('location.placeHere', { name: t('common.allLocations') })}
                </Text>
              </AnimatedPressable>
            )
          )}

          {isLoading ? (
            <ActivityIndicator style={styles.loading} color={theme.colors.primary} />
          ) : (
            <FlatList
              data={locations}
              keyExtractor={(item) => item.id}
              style={styles.list}
              ListEmptyComponent={
                <Text style={styles.emptyText}>{t('location.noChildren')}</Text>
              }
              renderItem={({ item }) => (
                <AnimatedPressable style={styles.row} onPress={() => setCurrentId(item.id)}>
                  <LocationThumbnail
                    photoPath={item.photo_url}
                    style={styles.rowThumbnail}
                    fallbackIconStyle={styles.rowIcon}
                  />
                  <Text style={styles.rowText}>{item.name}</Text>
                </AnimatedPressable>
              )}
            />
          )}

          {isAdding ? (
            <View style={styles.addForm}>
              <TextInput
                style={styles.input}
                placeholder={t('location.newNamePlaceholder')}
                value={newName}
                onChangeText={setNewName}
                autoFocus
              />
              <View style={styles.addFormActions}>
                <AnimatedPressable
                  style={styles.cancelButton}
                  onPress={() => {
                    setIsAdding(false);
                    setNewName('');
                  }}
                >
                  <Text>{t('common.cancel')}</Text>
                </AnimatedPressable>
                <AnimatedPressable
                  style={styles.saveButton}
                  onPress={handleCreateLocation}
                  disabled={isSaving || !newName.trim()}
                >
                  {isSaving ? (
                    <ActivityIndicator color={theme.colors.primaryText} />
                  ) : (
                    <Text style={styles.saveButtonText}>{t('location.createAndSelect')}</Text>
                  )}
                </AnimatedPressable>
              </View>
            </View>
          ) : (
            <AnimatedPressable style={styles.addButton} onPress={() => setIsAdding(true)}>
              <Text style={styles.addButtonText}>{t('location.addNewHere')}</Text>
            </AnimatedPressable>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

function createStyles(theme: Theme) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: theme.colors.overlay,
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: theme.colors.surface,
      borderTopLeftRadius: theme.radius.lg + 4,
      borderTopRightRadius: theme.radius.lg + 4,
      padding: theme.spacing.xl,
      maxHeight: '80%',
      minHeight: '50%',
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: theme.spacing.md,
    },
    title: { fontSize: theme.fontSize.lg, fontWeight: '600', color: theme.colors.text },
    closeText: { color: theme.colors.primary },
    breadcrumbContainer: { marginBottom: theme.spacing.sm },
    selectCurrentButton: {
      backgroundColor: theme.colors.surfaceAlt,
      borderRadius: theme.radius.md,
      padding: theme.spacing.md,
      marginBottom: theme.spacing.sm,
    },
    selectCurrentText: { color: theme.colors.primary, fontWeight: '600', textAlign: 'center' },
    loading: { marginTop: 20 },
    list: { flexGrow: 0 },
    emptyText: { textAlign: 'center', color: theme.colors.textFaint, marginTop: 20 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: theme.spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    rowIcon: { fontSize: theme.fontSize.md + 2, marginRight: 10, color: theme.colors.text },
    rowThumbnail: { width: 28, height: 28, borderRadius: theme.radius.sm, marginRight: 10 },
    rowText: { fontSize: theme.fontSize.base, color: theme.colors.text },
    addButton: {
      backgroundColor: theme.colors.surfaceAlt,
      borderRadius: theme.radius.md,
      padding: theme.spacing.md,
      marginTop: theme.spacing.md,
      alignItems: 'center',
    },
    addButtonText: { color: theme.colors.text, fontWeight: '600' },
    addForm: { marginTop: theme.spacing.md },
    input: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.md,
      padding: theme.spacing.md,
      fontSize: theme.fontSize.md,
      color: theme.colors.text,
    },
    addFormActions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      marginTop: 10,
      gap: theme.spacing.md,
    },
    cancelButton: { padding: 10 },
    saveButton: {
      backgroundColor: theme.colors.primary,
      paddingVertical: 10,
      paddingHorizontal: theme.spacing.lg,
      borderRadius: theme.radius.md,
      minWidth: 130,
      alignItems: 'center',
    },
    saveButtonText: { color: theme.colors.primaryText, fontWeight: '600' },
  });
}
