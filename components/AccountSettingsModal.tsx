import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import AnimatedPressable from './AnimatedPressable';
import BottomSheetModal from './BottomSheetModal';
import { useAuth } from '../lib/auth-context';
import { useAlertInfo, useConfirm } from '../lib/confirm';
import { useDataRefresh } from '../lib/data-refresh';
import { describeError } from '../lib/error-message';
import { buildExportArchive, deleteAllUserData, type ExportProgress } from '../lib/gdpr';
import { saveBlobFile } from '../lib/save-file';
import { pb } from '../lib/pocketbase';
import { useSubscription } from '../lib/subscription-context';
import { FREE_LIMITS } from '../lib/subscription';
import type { Theme } from '../lib/theme';
import { useTheme } from '../lib/theme-context';

type Props = {
  visible: boolean;
  onClose: () => void;
};

export default function AccountSettingsModal({ visible, onClose }: Props) {
  const { t } = useTranslation();
  const { session } = useAuth();
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const confirm = useConfirm();
  const alertInfo = useAlertInfo();
  const { notifyChanged } = useDataRefresh();
  const { usage, isPremiumUser } = useSubscription();
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState<ExportProgress | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleExport() {
    setIsExporting(true);
    setExportProgress(null);
    try {
      const archive = await buildExportArchive(setExportProgress);
      const fileName = `inwentarz-domowy-${new Date().toISOString().slice(0, 10)}.zip`;
      await saveBlobFile(fileName, archive, 'application/zip');
    } catch (error) {
      await alertInfo(t('common.error'), describeError(error, t, 'account.exportFailed'));
    } finally {
      setIsExporting(false);
      setExportProgress(null);
    }
  }

  async function handleDeleteData() {
    const confirmed = await confirm({
      title: t('account.deleteDataTitle'),
      message: t('account.deleteDataConfirm'),
    });
    if (!confirmed) return;

    setIsDeleting(true);
    try {
      await deleteAllUserData();
      notifyChanged();
      onClose();
      await alertInfo(t('account.deleteDataDoneTitle'), t('account.deleteDataDone'));
    } catch (error) {
      await alertInfo(t('common.error'), describeError(error, t, 'account.deleteFailed'));
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <BottomSheetModal visible={visible} onClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>{t('account.title')}</Text>
          <AnimatedPressable onPress={onClose}>
            <Text style={styles.closeText}>{t('common.close')}</Text>
          </AnimatedPressable>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('account.accountSection')}</Text>
            <Text style={styles.value}>{session?.user.email}</Text>
            <Text style={styles.plan}>
              {isPremiumUser ? t('account.planPremium') : t('account.planFree')}
            </Text>
            {!isPremiumUser && (
              <Text style={styles.usage}>
                {t('account.usage', {
                  items: usage.items,
                  itemsLimit: FREE_LIMITS.items,
                  photos: usage.photos,
                  photosLimit: FREE_LIMITS.photos,
                })}
              </Text>
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('account.dataSection')}</Text>
            <Text style={styles.description}>{t('account.exportDescription')}</Text>
            <AnimatedPressable style={styles.button} onPress={handleExport} disabled={isExporting}>
              {isExporting ? (
                <View style={styles.buttonBusy}>
                  <ActivityIndicator color={theme.colors.primaryText} />
                  {exportProgress && exportProgress.totalPhotos > 0 && (
                    <Text style={styles.buttonText}>
                      {t('account.exportProgress', exportProgress)}
                    </Text>
                  )}
                </View>
              ) : (
                <Text style={styles.buttonText}>{t('account.exportButton')}</Text>
              )}
            </AnimatedPressable>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitleDanger}>{t('account.dangerSection')}</Text>
            <Text style={styles.description}>{t('account.deleteDataDescription')}</Text>
            <AnimatedPressable
              style={styles.dangerButton}
              onPress={handleDeleteData}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <ActivityIndicator color={theme.colors.dangerText} />
              ) : (
                <Text style={styles.dangerButtonText}>{t('account.deleteDataButton')}</Text>
              )}
            </AnimatedPressable>
            <Text style={styles.note}>{t('account.deleteAccountNote')}</Text>
          </View>

          <AnimatedPressable style={styles.signOutButton} onPress={() => pb.authStore.clear()}>
            <Text style={styles.signOutText}>{t('auth.signOut')}</Text>
          </AnimatedPressable>
        </ScrollView>
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
    title: { fontSize: theme.fontSize.xl, fontWeight: 'bold', color: theme.colors.text },
    closeText: { color: theme.colors.primary, fontSize: theme.fontSize.md },
    content: { padding: theme.spacing.lg, gap: theme.spacing.xl },
    section: { gap: theme.spacing.sm },
    sectionTitle: {
      fontSize: theme.fontSize.sm,
      fontWeight: '600',
      color: theme.colors.textMuted,
      textTransform: 'uppercase',
    },
    sectionTitleDanger: {
      fontSize: theme.fontSize.sm,
      fontWeight: '600',
      color: theme.colors.danger,
      textTransform: 'uppercase',
    },
    value: { fontSize: theme.fontSize.md, color: theme.colors.text },
    plan: { fontSize: theme.fontSize.sm, color: theme.colors.primary, fontWeight: '600' },
    usage: { fontSize: theme.fontSize.xs, color: theme.colors.textFaint },
    description: { fontSize: theme.fontSize.sm, color: theme.colors.textMuted },
    button: {
      backgroundColor: theme.colors.primary,
      borderRadius: theme.radius.md,
      padding: theme.spacing.md,
      alignItems: 'center',
      marginTop: theme.spacing.xs,
    },
    buttonText: { color: theme.colors.primaryText, fontWeight: '600' },
    buttonBusy: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
    dangerButton: {
      backgroundColor: theme.colors.danger,
      borderRadius: theme.radius.md,
      padding: theme.spacing.md,
      alignItems: 'center',
      marginTop: theme.spacing.xs,
    },
    dangerButtonText: { color: theme.colors.dangerText, fontWeight: '600' },
    note: { fontSize: theme.fontSize.xs, color: theme.colors.textFaint, marginTop: theme.spacing.xs },
    signOutButton: {
      backgroundColor: theme.colors.surfaceAlt,
      borderRadius: theme.radius.md,
      padding: theme.spacing.md,
      alignItems: 'center',
    },
    signOutText: { color: theme.colors.text, fontWeight: '600' },
  });
}
