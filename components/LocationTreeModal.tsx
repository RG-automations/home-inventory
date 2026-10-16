import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import AnimatedPressable from './AnimatedPressable';
import BottomSheetModal from './BottomSheetModal';
import LocationTreeNode from './LocationTreeNode';
import QuickActions from './QuickActions';
import { getLocationTree, type LocationTreeNode as TreeNode } from '../lib/locations';
import type { Theme } from '../lib/theme';
import { useTheme } from '../lib/theme-context';

type Props = {
  visible: boolean;
  onClose: () => void;
};

export default function LocationTreeModal({ visible, onClose }: Props) {
  const { t } = useTranslation();
  const router = useRouter();
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!visible) return;
    setIsLoading(true);
    getLocationTree().then((data) => {
      setTree(data);
      setIsLoading(false);
    });
  }, [visible]);

  function handleSelect(node: TreeNode) {
    onClose();
    router.push(`/location/${node.id}`);
  }

  return (
    <BottomSheetModal visible={visible} onClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title} numberOfLines={1}>
            {t('locationTree.title')}
          </Text>
          <View style={styles.headerActions}>
            <QuickActions />
            <AnimatedPressable onPress={onClose}>
              <Text style={styles.closeText}>{t('common.close')}</Text>
            </AnimatedPressable>
          </View>
        </View>

        {isLoading ? (
          <ActivityIndicator style={styles.loading} color={theme.colors.primary} size="large" />
        ) : tree.length === 0 ? (
          <Text style={styles.emptyText}>{t('locationTree.empty')}</Text>
        ) : (
          <ScrollView>
            {tree.map((node) => (
              <LocationTreeNode key={node.id} node={node} depth={0} onSelect={handleSelect} />
            ))}
          </ScrollView>
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
    loading: { marginTop: theme.spacing.xxl },
    emptyText: { textAlign: 'center', color: theme.colors.textFaint, marginTop: theme.spacing.xxl },
  });
}
