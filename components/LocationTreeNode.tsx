import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LayoutAnimation, Platform, StyleSheet, Text, UIManager, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import type { LocationTreeNode as TreeNode } from '../lib/locations';
import { PRESS_TIMING_CONFIG } from '../lib/press';
import type { Theme } from '../lib/theme';
import { useTheme } from '../lib/theme-context';
import AnimatedPressable from './AnimatedPressable';
import LocationThumbnail from './LocationThumbnail';

// Android wymaga tego jednorazowego opt-in, zeby LayoutAnimation dzialalo
// w ogole (iOS ma to wlaczone domyslnie).
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type Props = {
  node: TreeNode;
  depth: number;
  onSelect: (node: TreeNode) => void;
};

export default function LocationTreeNode({ node, depth, onSelect }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const styles = createStyles(theme);
  const [isExpanded, setIsExpanded] = useState(depth === 0);
  const hasChildren = node.children.length > 0;
  const rotation = useSharedValue(isExpanded ? 90 : 0);

  useEffect(() => {
    rotation.value = withTiming(isExpanded ? 90 : 0, PRESS_TIMING_CONFIG);
  }, [isExpanded, rotation]);

  const disclosureIconStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  function toggleExpanded() {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsExpanded((current) => !current);
  }

  return (
    <View>
      <AnimatedPressable
        style={[styles.row, { paddingLeft: theme.spacing.md + depth * 20 }]}
        onPress={() => onSelect(node)}
      >
        {hasChildren ? (
          <AnimatedPressable
            hitSlop={8}
            onPress={(e) => {
              e.stopPropagation();
              toggleExpanded();
            }}
            style={styles.disclosure}
          >
            <Animated.Text style={[styles.disclosureIcon, disclosureIconStyle]}>▶</Animated.Text>
          </AnimatedPressable>
        ) : (
          <View style={styles.disclosure} />
        )}
        <LocationThumbnail
          photoPath={node.photo_url}
          style={styles.thumbnail}
          fallbackIconStyle={styles.folderIcon}
        />
        <Text style={styles.name} numberOfLines={1}>
          {node.name}
        </Text>
        {node.itemCount > 0 && (
          <Text style={styles.itemCount}>{t('locationTree.itemCount', { count: node.itemCount })}</Text>
        )}
      </AnimatedPressable>

      {isExpanded &&
        node.children.map((child) => (
          <LocationTreeNode key={child.id} node={child} depth={depth + 1} onSelect={onSelect} />
        ))}
    </View>
  );
}

function createStyles(theme: Theme) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: theme.spacing.sm,
      paddingRight: theme.spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    disclosure: {
      width: 24,
      height: 24,
      alignItems: 'center',
      justifyContent: 'center',
    },
    disclosureIcon: { fontSize: theme.fontSize.xs, color: theme.colors.textMuted },
    folderIcon: { fontSize: theme.fontSize.md, marginRight: theme.spacing.sm },
    thumbnail: { width: 22, height: 22, borderRadius: theme.radius.sm, marginRight: theme.spacing.sm },
    name: { flex: 1, fontSize: theme.fontSize.base, color: theme.colors.text },
    itemCount: { fontSize: theme.fontSize.xs, color: theme.colors.textFaint },
  });
}
