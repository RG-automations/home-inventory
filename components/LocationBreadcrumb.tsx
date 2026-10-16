import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import AnimatedPressable from './AnimatedPressable';
import type { Location } from '../lib/locations';
import type { Theme } from '../lib/theme';
import { useTheme } from '../lib/theme-context';

type Props = {
  path: Location[];
  /** Wywolywane po kliknieciu w element sciezki; null oznacza korzen ("Wszystkie miejsca"). */
  onNavigate: (locationId: string | null) => void;
};

export default function LocationBreadcrumb({ path, onNavigate }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.breadcrumb}>
      <AnimatedPressable onPress={() => onNavigate(null)}>
        <Text style={styles.link}>{t('common.allLocations')}</Text>
      </AnimatedPressable>
      {path.map((location) => (
        <View key={location.id} style={styles.item}>
          <Text style={styles.separator}> › </Text>
          <AnimatedPressable onPress={() => onNavigate(location.id)}>
            <Text style={styles.link}>{location.name}</Text>
          </AnimatedPressable>
        </View>
      ))}
    </View>
  );
}

function createStyles(theme: Theme) {
  return StyleSheet.create({
    breadcrumb: { flexDirection: 'row', flexWrap: 'wrap' },
    item: { flexDirection: 'row' },
    link: { color: theme.colors.primary, fontSize: theme.fontSize.sm },
    separator: { color: theme.colors.textFaint, fontSize: theme.fontSize.sm },
  });
}
