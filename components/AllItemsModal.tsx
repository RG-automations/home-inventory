import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import AnimatedPressable from './AnimatedPressable';
import BottomSheetModal from './BottomSheetModal';
import ItemThumbnail from './ItemThumbnail';
import QuickActions from './QuickActions';
import {
  formatLocationPath,
  getAllItems,
  type ItemSearchResult,
  type ItemSortBy,
} from '../lib/locations';
import type { Theme } from '../lib/theme';
import { useTheme } from '../lib/theme-context';

type Props = {
  visible: boolean;
  onClose: () => void;
};

type ViewMode = 'list' | 'grid';

const TARGET_TILE_SIZE = 110;

export default function AllItemsModal({ visible, onClose }: Props) {
  const { t } = useTranslation();
  const router = useRouter();
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const numColumns = Math.max(3, Math.floor(width / TARGET_TILE_SIZE));
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [items, setItems] = useState<ItemSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sortBy, setSortBy] = useState<ItemSortBy>('name');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [filter, setFilter] = useState('');

  useEffect(() => {
    if (!visible) return;
    setIsLoading(true);
    getAllItems(sortBy).then((data) => {
      setItems(data);
      setIsLoading(false);
    });
  }, [visible, sortBy]);

  // Czyscimy filtr przy zamknieciu, zeby po ponownym otwarciu
  // nie zaskakiwac uzytkownika przefiltrowana lista.
  useEffect(() => {
    if (!visible) setFilter('');
  }, [visible]);

  // Filtrowanie po stronie klienta — lista jest juz pobrana, wiec reakcja
  // jest natychmiastowa i nie obciazamy bazy przy kazdej literze.
  const visibleItems = useMemo(() => {
    const query = filter.trim().toLowerCase();
    if (!query) return items;

    return items.filter((item) => {
      const haystack = [item.name, item.description ?? '', formatLocationPath(item.locationPath)]
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [items, filter]);

  function handleSelect(item: ItemSearchResult) {
    onClose();
    router.push(`/location/${item.location_id}`);
  }

  // "Nie masz przedmiotow" to co innego niz "filtr nic nie znalazl".
  const emptyMessage =
    filter.trim() && items.length > 0
      ? t('allItems.noFilterResults', { query: filter.trim() })
      : t('allItems.empty');

  return (
    <BottomSheetModal visible={visible} onClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title} numberOfLines={1}>
            {t('allItems.title')}
          </Text>
          <View style={styles.headerActions}>
            <QuickActions />
            <AnimatedPressable onPress={onClose}>
              <Text style={styles.closeText}>{t('common.close')}</Text>
            </AnimatedPressable>
          </View>
        </View>

        <View style={styles.filterRow}>
          <TextInput
            style={styles.filterInput}
            placeholder={t('allItems.filterPlaceholder')}
            placeholderTextColor={theme.colors.textFaint}
            value={filter}
            onChangeText={setFilter}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {filter.length > 0 && (
            <AnimatedPressable style={styles.clearButton} onPress={() => setFilter('')} hitSlop={8}>
              <Text style={styles.clearIcon}>✕</Text>
            </AnimatedPressable>
          )}
        </View>

        <View style={styles.controlsRow}>
          <View style={styles.sortRow}>
            <AnimatedPressable
              style={[styles.sortButton, sortBy === 'name' && styles.sortButtonActive]}
              onPress={() => setSortBy('name')}
            >
              <Text
                style={[styles.sortButtonText, sortBy === 'name' && styles.sortButtonTextActive]}
              >
                {t('allItems.sortByName')}
              </Text>
            </AnimatedPressable>
            <AnimatedPressable
              style={[styles.sortButton, sortBy === 'newest' && styles.sortButtonActive]}
              onPress={() => setSortBy('newest')}
            >
              <Text
                style={[styles.sortButtonText, sortBy === 'newest' && styles.sortButtonTextActive]}
              >
                {t('allItems.sortByNewest')}
              </Text>
            </AnimatedPressable>
          </View>

          <AnimatedPressable
            style={styles.viewModeButton}
            onPress={() => setViewMode(viewMode === 'list' ? 'grid' : 'list')}
          >
            <Text style={styles.viewModeIcon}>{viewMode === 'list' ? '▦' : '☰'}</Text>
          </AnimatedPressable>
        </View>

        {isLoading ? (
          <ActivityIndicator style={styles.loading} color={theme.colors.primary} size="large" />
        ) : viewMode === 'list' ? (
          <FlatList
            data={visibleItems}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            ListEmptyComponent={<Text style={styles.emptyText}>{emptyMessage}</Text>}
            renderItem={({ item }) => (
              <AnimatedPressable style={styles.row} onPress={() => handleSelect(item)}>
                <ItemThumbnail
                  photoPath={item.photo_url}
                  style={styles.rowThumbnail}
                  fallbackIconStyle={styles.rowIcon}
                />
                <View style={styles.rowTextContainer}>
                  <Text style={styles.rowName}>{item.name}</Text>
                  <Text style={styles.rowPath}>{formatLocationPath(item.locationPath)}</Text>
                </View>
              </AnimatedPressable>
            )}
          />
        ) : (
          <FlatList
            key={numColumns}
            data={visibleItems}
            keyExtractor={(item) => item.id}
            numColumns={numColumns}
            contentContainerStyle={styles.grid}
            ListEmptyComponent={<Text style={styles.emptyText}>{emptyMessage}</Text>}
            renderItem={({ item }) => (
              <AnimatedPressable
                style={[styles.tile, { flexBasis: `${100 / numColumns}%` }]}
                onPress={() => handleSelect(item)}
              >
                <ItemThumbnail
                  photoPath={item.photo_url}
                  style={styles.tileImage}
                  fallbackIconStyle={styles.tileFallbackIcon}
                />
                <Text style={styles.tileName} numberOfLines={1}>
                  {item.name}
                </Text>
              </AnimatedPressable>
            )}
          />
        )}
      </View>
    </BottomSheetModal>
  );
}

function createStyles(theme: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: theme.spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    title: { flex: 1, fontSize: theme.fontSize.xl, fontWeight: 'bold', color: theme.colors.text },
    headerActions: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md },
    closeText: { color: theme.colors.primary, fontSize: theme.fontSize.md },
    filterRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginHorizontal: theme.spacing.lg,
      marginTop: theme.spacing.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.surface,
    },
    filterInput: {
      flex: 1,
      padding: theme.spacing.md,
      fontSize: theme.fontSize.md,
      color: theme.colors.text,
    },
    clearButton: { paddingHorizontal: theme.spacing.md },
    clearIcon: { fontSize: theme.fontSize.md, color: theme.colors.textFaint },
    controlsRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: theme.spacing.lg,
      paddingTop: theme.spacing.md,
      paddingBottom: theme.spacing.sm,
    },
    sortRow: { flexDirection: 'row', gap: theme.spacing.sm },
    sortButton: {
      paddingVertical: theme.spacing.sm,
      paddingHorizontal: theme.spacing.md,
      borderRadius: theme.radius.full,
      backgroundColor: theme.colors.surfaceAlt,
    },
    sortButtonActive: { backgroundColor: theme.colors.primary },
    sortButtonText: { fontSize: theme.fontSize.sm, color: theme.colors.text },
    sortButtonTextActive: { color: theme.colors.primaryText, fontWeight: '600' },
    viewModeButton: {
      width: 36,
      height: 36,
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.surfaceAlt,
      alignItems: 'center',
      justifyContent: 'center',
    },
    viewModeIcon: { fontSize: theme.fontSize.md, color: theme.colors.text },
    loading: { marginTop: theme.spacing.xxl },
    list: { padding: theme.spacing.lg, flexGrow: 1 },
    emptyText: { textAlign: 'center', color: theme.colors.textFaint, marginTop: theme.spacing.xxl },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: theme.spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    rowThumbnail: { width: 44, height: 44, borderRadius: theme.radius.sm, marginRight: theme.spacing.md },
    rowIcon: { fontSize: theme.fontSize.xl, color: theme.colors.text, marginRight: theme.spacing.md },
    rowTextContainer: { flex: 1 },
    rowName: { fontSize: theme.fontSize.base, fontWeight: '500', color: theme.colors.text },
    rowPath: { fontSize: theme.fontSize.xs, color: theme.colors.textFaint, marginTop: 2 },
    grid: { padding: theme.spacing.sm, flexGrow: 1 },
    tile: { padding: theme.spacing.xs, alignItems: 'center' },
    tileImage: {
      width: '100%',
      maxWidth: TARGET_TILE_SIZE,
      aspectRatio: 1,
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.surfaceAlt,
    },
    tileFallbackIcon: { fontSize: theme.fontSize.xxxl, color: theme.colors.text },
    tileName: {
      fontSize: theme.fontSize.xs,
      color: theme.colors.text,
      marginTop: theme.spacing.xs,
      textAlign: 'center',
    },
  });
}
