import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import AddItemModal from './AddItemModal';
import AnimatedPressable from './AnimatedPressable';
import EditItemModal from './EditItemModal';
import LocationBreadcrumb from './LocationBreadcrumb';
import UpgradeModal from './UpgradeModal';
import EditLocationModal from './EditLocationModal';
import ItemThumbnail from './ItemThumbnail';
import LocationThumbnail from './LocationThumbnail';
import SwipeableRow from './SwipeableRow';
import { useConfirm } from '../lib/confirm';
import { useDataRefresh } from '../lib/data-refresh';
import { useSubscription } from '../lib/subscription-context';
import { deleteItem } from '../lib/items';
import {
  createLocation,
  deleteLocation,
  getChildLocations,
  getItemsInLocation,
  getLocationPath,
  locationHasContent,
  type Item,
  type Location,
} from '../lib/locations';
import type { Theme } from '../lib/theme';
import { useTheme } from '../lib/theme-context';
import { useReducedMotion } from '../lib/use-reduced-motion';

type Props = {
  locationId: string | null;
};

export default function LocationBrowser({ locationId }: Props) {
  const { t } = useTranslation();
  const router = useRouter();
  const confirm = useConfirm();
  const { subscribe, notifyChanged } = useDataRefresh();
  const theme = useTheme();
  const isReducedMotion = useReducedMotion();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [path, setPath] = useState<Location[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isAddItemVisible, setIsAddItemVisible] = useState(false);
  const [newLocationName, setNewLocationName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [isUpgradeVisible, setIsUpgradeVisible] = useState(false);
  const { canAddItem } = useSubscription();

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [childLocations, breadcrumb, locationItems] = await Promise.all([
        getChildLocations(locationId),
        locationId ? getLocationPath(locationId) : Promise.resolve([]),
        locationId ? getItemsInLocation(locationId) : Promise.resolve([]),
      ]);
      setLocations(childLocations);
      setPath(breadcrumb);
      setItems(locationItems);
    } catch {
      // Miejsce moglo zostac usuniete (np. kaskadowo z innego ekranu) —
      // zamiast zostawiac zawieszony ekran, wracamy do listy glownej.
      router.replace('/');
    } finally {
      setIsLoading(false);
    }
  }, [locationId, router]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => subscribe(loadData), [subscribe, loadData]);

  // Bez memoizacji FlatList dostawalby nowa tablice przy kazdym renderze
  // (np. przy pisaniu w polu nazwy nowego miejsca) i przerysowywal cala liste.
  const entries = useMemo(
    () => [
      ...locations.map((l) => ({ type: 'location' as const, data: l })),
      ...items.map((i) => ({ type: 'item' as const, data: i })),
    ],
    [locations, items],
  );

  async function handleAddLocation() {
    if (!newLocationName.trim()) return;
    setIsSaving(true);
    await createLocation(newLocationName.trim(), locationId);
    setIsSaving(false);
    setNewLocationName('');
    setIsModalVisible(false);
    notifyChanged();
  }

  async function handleDeleteLocation(location: Location) {
    const hasContent = await locationHasContent(location.id);
    const message = hasContent
      ? t('location.deleteConfirmWithContent', { name: location.name })
      : t('location.deleteConfirm', { name: location.name });

    const confirmed = await confirm({ title: t('location.deleteTitle'), message });
    if (!confirmed) return;

    await deleteLocation(location.id);
    loadData();
  }

  async function handleDeleteItem(item: Item) {
    const confirmed = await confirm({
      title: t('item.deleteTitle'),
      message: t('item.deleteConfirm', { name: item.name }),
    });
    if (!confirmed) return;

    await deleteItem(item.id, item.photo_url);
    loadData();
  }

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {path.length > 0 && (
        <View style={styles.breadcrumbContainer}>
          {/* Przycisk "do gory" — skrot do miejsca nadrzednego. Sciezka
              nawigacji bywa dluga i na malym ekranie trudno trafic palcem
              w przedostatni element; tutaj cel jest zawsze ten sam. */}
          <AnimatedPressable
            style={styles.upButton}
            pressedScale={0.95}
            onPress={() => {
              const parent = path[path.length - 2];
              router.push(parent ? `/location/${parent.id}` : '/');
            }}
            hitSlop={8}
            accessibilityLabel={t('common.up')}
          >
            <Text style={styles.upButtonIcon}>↑</Text>
            <Text style={styles.upButtonText}>{t('common.up')}</Text>
          </AnimatedPressable>

          <LocationBreadcrumb
            path={path}
            onNavigate={(id) => router.push(id ? `/location/${id}` : '/')}
          />
        </View>
      )}

      <FlatList
        data={entries}
        keyExtractor={(entry) => `${entry.type}-${entry.data.id}`}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          locations.length + items.length > 0 ? (
            <Text style={styles.hint}>
              {Platform.OS === 'web'
                ? t('location.hintWeb')
                : t('location.hintNative')}
            </Text>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📦</Text>
            <Text style={styles.emptyText}>{t('location.empty')}</Text>
          </View>
        }
        renderItem={({ item: entry }) =>
          entry.type === 'location' ? (
            <SwipeableRow
              onEdit={() => setEditingLocation(entry.data)}
              onDelete={() => handleDeleteLocation(entry.data)}
            >
              <Pressable
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                onPress={() => router.push(`/location/${entry.data.id}`)}
              >
                <LocationThumbnail
                  photoPath={entry.data.photo_url}
                  style={styles.rowThumbnail}
                  fallbackIconStyle={styles.rowIcon}
                />
                <Text style={styles.rowText}>{entry.data.name}</Text>
                <Text style={styles.rowChevron}>›</Text>
              </Pressable>
            </SwipeableRow>
          ) : (
            <SwipeableRow
              onEdit={() => setEditingItem(entry.data)}
              onDelete={() => handleDeleteItem(entry.data)}
            >
              <Pressable
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                onPress={() => setEditingItem(entry.data)}
              >
                <ItemThumbnail
                  photoPath={entry.data.photo_url}
                  style={styles.rowThumbnail}
                  fallbackIconStyle={styles.rowIcon}
                />
                <View style={styles.rowTextContainer}>
                  <Text style={styles.rowText}>{entry.data.name}</Text>
                  {entry.data.description && (
                    <Text style={styles.rowDescription} numberOfLines={1}>
                      {entry.data.description}
                    </Text>
                  )}
                </View>
              </Pressable>
            </SwipeableRow>
          )
        }
      />

      <View style={styles.fabRow}>
        <AnimatedPressable
          style={styles.fabSecondary}
          pressedScale={0.97}
          onPress={() => setIsModalVisible(true)}
        >
          <Text style={styles.fabSecondaryText}>{t('location.addButton')}</Text>
        </AnimatedPressable>
        {locationId && (
          <AnimatedPressable
            style={styles.fab}
            pressedScale={0.97}
            onPress={() => (canAddItem ? setIsAddItemVisible(true) : setIsUpgradeVisible(true))}
          >
            <Text style={styles.fabText}>{t('location.addItemButton')}</Text>
          </AnimatedPressable>
        )}
      </View>

      {locationId && (
        <AddItemModal
          visible={isAddItemVisible}
          locationId={locationId}
          onClose={() => setIsAddItemVisible(false)}
          onSaved={() => {}}
        />
      )}

      <EditItemModal
        visible={editingItem !== null}
        item={editingItem}
        onClose={() => setEditingItem(null)}
        onSaved={() => {}}
      />

      <EditLocationModal
        visible={editingLocation !== null}
        location={editingLocation}
        onClose={() => setEditingLocation(null)}
        onSaved={() => {}}
      />

      <UpgradeModal
        visible={isUpgradeVisible}
        reason="items"
        onClose={() => setIsUpgradeVisible(false)}
      />

      <Modal visible={isModalVisible} transparent animationType={isReducedMotion ? 'none' : 'fade'}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t('location.new')}</Text>
            <TextInput
              style={styles.input}
              placeholder={t('location.nameExample')}
              value={newLocationName}
              onChangeText={setNewLocationName}
              autoFocus
            />
            <View style={styles.modalActions}>
              <Pressable
                style={({ pressed }) => [styles.modalCancel, pressed && styles.modalCancelPressed]}
                onPress={() => {
                  setIsModalVisible(false);
                  setNewLocationName('');
                }}
              >
                <Text style={styles.modalCancelText}>{t('common.cancel')}</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.modalSave,
                  (isSaving || !newLocationName.trim()) && styles.buttonDisabled,
                  pressed && styles.buttonPressed,
                ]}
                onPress={handleAddLocation}
                disabled={isSaving || !newLocationName.trim()}
              >
                {isSaving ? (
                  <ActivityIndicator color={theme.colors.primaryText} />
                ) : (
                  <Text style={styles.modalSaveText}>{t('common.save')}</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function createStyles(theme: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    breadcrumbContainer: {
      padding: theme.spacing.lg,
      paddingBottom: theme.spacing.sm,
    },
    upButton: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      gap: theme.spacing.xs,
      paddingVertical: theme.spacing.xs,
      paddingHorizontal: theme.spacing.sm,
      marginBottom: theme.spacing.sm,
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.surfaceAlt,
    },
    upButtonIcon: { fontSize: theme.fontSize.md, color: theme.colors.text },
    upButtonText: { fontSize: theme.fontSize.sm, color: theme.colors.text },
    list: { padding: theme.spacing.lg, flexGrow: 1 },
    hint: {
      fontSize: theme.fontSize.xs,
      color: theme.colors.textFaint,
      marginBottom: theme.spacing.sm,
    },
    emptyState: { alignItems: 'center', marginTop: 80, gap: theme.spacing.md },
    emptyIcon: { fontSize: 48 },
    emptyText: {
      textAlign: 'center',
      color: theme.colors.textFaint,
      paddingHorizontal: theme.spacing.xl,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      paddingHorizontal: theme.spacing.md,
      borderRadius: theme.radius.lg,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
    },
    rowPressed: { backgroundColor: theme.colors.surfaceAlt },
    rowTextContainer: { flex: 1 },
    rowChevron: {
      marginLeft: 'auto',
      fontSize: theme.fontSize.xxl,
      color: theme.colors.textFaint,
    },
    rowIcon: { fontSize: theme.fontSize.xl, marginRight: theme.spacing.md, color: theme.colors.text },
    rowThumbnail: {
      width: 40,
      height: 40,
      borderRadius: theme.radius.sm,
      marginRight: theme.spacing.md,
    },
    rowText: { fontSize: theme.fontSize.md, color: theme.colors.text, flexShrink: 1 },
    rowDescription: { fontSize: theme.fontSize.sm, color: theme.colors.textFaint },
    fabRow: {
      flexDirection: 'row',
      gap: theme.spacing.md,
      marginHorizontal: theme.spacing.lg,
      marginVertical: theme.spacing.lg,
    },
    fab: {
      flex: 1,
      backgroundColor: theme.colors.primary,
      padding: 14,
      borderRadius: theme.radius.md,
      alignItems: 'center',
      shadowColor: '#000',
      shadowOpacity: 0.15,
      shadowRadius: 4,
      shadowOffset: { width: 0, height: 2 },
      elevation: 3,
    },
    fabText: { color: theme.colors.primaryText, fontSize: theme.fontSize.md, fontWeight: '600' },
    fabSecondary: {
      flex: 1,
      backgroundColor: theme.colors.surfaceAlt,
      padding: 14,
      borderRadius: theme.radius.md,
      alignItems: 'center',
    },
    fabSecondaryText: { color: theme.colors.text, fontSize: theme.fontSize.md, fontWeight: '600' },
    buttonPressed: { transform: [{ scale: 0.97 }] },
    modalOverlay: {
      flex: 1,
      backgroundColor: theme.colors.overlay,
      alignItems: 'center',
      justifyContent: 'center',
    },
    modalCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.lg,
      padding: theme.spacing.xl,
      width: '85%',
      maxWidth: 400,
    },
    modalTitle: { fontSize: theme.fontSize.lg, fontWeight: '600', marginBottom: theme.spacing.md, color: theme.colors.text },
    input: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.md,
      padding: theme.spacing.md,
      fontSize: theme.fontSize.md,
      color: theme.colors.text,
    },
    modalActions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      marginTop: theme.spacing.lg,
      gap: theme.spacing.md,
    },
    modalCancel: {
      paddingVertical: 10,
      paddingHorizontal: theme.spacing.md,
      borderRadius: theme.radius.md,
    },
    modalCancelText: { color: theme.colors.textMuted, fontWeight: '600' },
    modalCancelPressed: { backgroundColor: theme.colors.surfaceAlt },
    modalSave: {
      backgroundColor: theme.colors.primary,
      paddingVertical: 10,
      paddingHorizontal: theme.spacing.lg,
      borderRadius: theme.radius.md,
      minWidth: 70,
      alignItems: 'center',
    },
    modalSaveText: { color: theme.colors.primaryText, fontWeight: '600' },
    buttonDisabled: { opacity: 0.5 },
  });
}
