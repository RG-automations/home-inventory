import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import ItemThumbnail from './ItemThumbnail';
import { formatLocationPath, searchItems, type ItemSearchResult } from '../lib/locations';
import type { Theme } from '../lib/theme';
import { useTheme } from '../lib/theme-context';
import { useReducedMotion } from '../lib/use-reduced-motion';

export default function SearchBar() {
  const { t } = useTranslation();
  const router = useRouter();
  const theme = useTheme();
  const isReducedMotion = useReducedMotion();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ItemSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setHasSearched(false);
      return;
    }

    setIsSearching(true);
    const timeout = setTimeout(async () => {
      const found = await searchItems(trimmed);
      setResults(found);
      setHasSearched(true);
      setIsSearching(false);
    }, 300);

    return () => clearTimeout(timeout);
  }, [query]);

  function handleSelect(result: ItemSearchResult) {
    setQuery('');
    setResults([]);
    setHasSearched(false);
    router.push(`/location/${result.location_id}`);
  }

  function handleClose() {
    setQuery('');
    setResults([]);
    setHasSearched(false);
  }

  const isOpen = query.trim().length > 0;

  return (
    <View>
      <TextInput
        style={[styles.input, isFocused && styles.inputFocused]}
        placeholder={t('search.placeholder')}
        placeholderTextColor={theme.colors.textFaint}
        value={query}
        onChangeText={setQuery}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
      />

      <Modal visible={isOpen} transparent animationType={isReducedMotion ? 'none' : 'fade'} onRequestClose={handleClose}>
        <Pressable style={styles.overlay} onPress={handleClose}>
          <Pressable style={styles.dropdown} onPress={(e) => e.stopPropagation()}>
            {isSearching ? (
              <ActivityIndicator style={styles.loading} color={theme.colors.primary} />
            ) : results.length === 0 && hasSearched ? (
              <Text style={styles.emptyText}>{t('search.noResults', { query })}</Text>
            ) : (
              <FlatList
                data={results}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <Pressable
                    style={({ pressed }) => [styles.resultRow, pressed && styles.resultRowPressed]}
                    onPress={() => handleSelect(item)}
                  >
                    <ItemThumbnail
                      photoPath={item.photo_url}
                      style={styles.resultThumbnail}
                      fallbackIconStyle={styles.resultIcon}
                    />
                    <View style={styles.resultTextContainer}>
                      <Text style={styles.resultName}>{item.name}</Text>
                      <Text style={styles.resultPath}>
                        {formatLocationPath(item.locationPath)}
                      </Text>
                    </View>
                  </Pressable>
                )}
              />
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function createStyles(theme: Theme) {
  return StyleSheet.create({
    input: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.md,
      padding: theme.spacing.md,
      fontSize: theme.fontSize.md,
      backgroundColor: theme.colors.surface,
      color: theme.colors.text,
    },
    inputFocused: { borderColor: theme.colors.primary },
    overlay: {
      flex: 1,
      backgroundColor: theme.colors.overlay,
      paddingHorizontal: theme.spacing.lg,
      paddingTop: 80,
    },
    dropdown: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.md,
      maxHeight: 400,
      overflow: 'hidden',
    },
    loading: { padding: theme.spacing.lg },
    emptyText: { padding: theme.spacing.lg, color: theme.colors.textFaint, textAlign: 'center' },
    resultRow: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: theme.spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
    },
    resultRowPressed: { backgroundColor: theme.colors.surfaceAlt },
    resultThumbnail: { width: 32, height: 32, borderRadius: theme.radius.sm, marginRight: 10 },
    resultIcon: { fontSize: theme.fontSize.md + 2, marginRight: 10, color: theme.colors.text },
    resultTextContainer: { flex: 1 },
    resultName: { fontSize: theme.fontSize.base, fontWeight: '500', color: theme.colors.text },
    resultPath: { fontSize: theme.fontSize.xs, color: theme.colors.textFaint, marginTop: 2 },
  });
}
