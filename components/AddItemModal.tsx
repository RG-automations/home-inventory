import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAlertInfo } from '../lib/confirm';
import AnimatedPressable from './AnimatedPressable';
import UpgradeModal from './UpgradeModal';
import { useDataRefresh } from '../lib/data-refresh';
import { describeError } from '../lib/error-message';
import { createItem, uploadItemPhoto } from '../lib/items';
import { useSubscription } from '../lib/subscription-context';
import type { Theme } from '../lib/theme';
import { useTheme } from '../lib/theme-context';
import { usePhotoPicker } from '../lib/use-photo-picker';
import { useReducedMotion } from '../lib/use-reduced-motion';

type Props = {
  visible: boolean;
  locationId: string;
  onClose: () => void;
  onSaved: () => void;
};

export default function AddItemModal({ visible, locationId, onClose, onSaved }: Props) {
  const { t } = useTranslation();
  const alertInfo = useAlertInfo();
  const { notifyChanged } = useDataRefresh();
  const { pickFromLibrary } = usePhotoPicker();
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isUpgradeVisible, setIsUpgradeVisible] = useState(false);
  const { canAddPhoto } = useSubscription();
  const isReducedMotion = useReducedMotion();

  function reset() {
    setName('');
    setDescription('');
    setPhotoUri(null);
  }

  async function handlePickPhoto() {
    if (!canAddPhoto) {
      setIsUpgradeVisible(true);
      return;
    }
    const uri = await pickFromLibrary();
    if (uri) setPhotoUri(uri);
  }

  async function handleSave() {
    if (!name.trim()) return;
    setIsSaving(true);

    try {
      const photoUrl = photoUri ? await uploadItemPhoto(photoUri) : null;
      await createItem({
        name: name.trim(),
        description: description.trim() || null,
        photoUrl,
        locationId,
      });
      reset();
      notifyChanged();
      onSaved();
      onClose();
    } catch (error) {
      await alertInfo(t('common.error'), describeError(error, t, 'common.itemSaveFailed'));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType={isReducedMotion ? 'none' : 'fade'}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>{t('item.new')}</Text>

          <AnimatedPressable style={styles.photoPicker} onPress={handlePickPhoto}>
            {photoUri ? (
              <Image source={{ uri: photoUri }} style={styles.photoPreview} />
            ) : (
              <Text style={styles.photoPickerText}>{t('item.addPhoto')}</Text>
            )}
          </AnimatedPressable>

          <TextInput
            style={styles.input}
            placeholder={t('item.namePlaceholder')}
            value={name}
            onChangeText={setName}
          />
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder={t('item.descriptionPlaceholder')}
            value={description}
            onChangeText={setDescription}
            multiline
          />

          <View style={styles.actions}>
            <AnimatedPressable
              style={styles.cancelButton}
              onPress={() => {
                reset();
                onClose();
              }}
            >
              <Text>{t('common.cancel')}</Text>
            </AnimatedPressable>
            <AnimatedPressable
              style={styles.saveButton}
              onPress={handleSave}
              disabled={isSaving || !name.trim()}
            >
              {isSaving ? (
                <ActivityIndicator color={theme.colors.primaryText} />
              ) : (
                <Text style={styles.saveButtonText}>{t('common.save')}</Text>
              )}
            </AnimatedPressable>
          </View>
        </View>
      </View>

      <UpgradeModal
        visible={isUpgradeVisible}
        reason="photos"
        onClose={() => setIsUpgradeVisible(false)}
      />
    </Modal>
  );
}

function createStyles(theme: Theme) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: theme.colors.overlay,
      alignItems: 'center',
      justifyContent: 'center',
    },
    card: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.lg,
      padding: theme.spacing.xl,
      width: '85%',
      maxWidth: 420,
    },
    title: { fontSize: theme.fontSize.lg, fontWeight: '600', marginBottom: theme.spacing.md, color: theme.colors.text },
    photoPicker: {
      height: 140,
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.surfaceAlt,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: theme.spacing.md,
      overflow: 'hidden',
    },
    photoPickerText: { color: theme.colors.textMuted, fontSize: theme.fontSize.md },
    photoPreview: { width: '100%', height: '100%' },
    input: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.md,
      padding: theme.spacing.md,
      fontSize: theme.fontSize.md,
      marginBottom: theme.spacing.md,
      color: theme.colors.text,
    },
    textArea: { minHeight: 70, textAlignVertical: 'top' },
    actions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: theme.spacing.md,
    },
    cancelButton: { padding: 10 },
    saveButton: {
      backgroundColor: theme.colors.primary,
      paddingVertical: 10,
      paddingHorizontal: theme.spacing.lg,
      borderRadius: theme.radius.md,
      minWidth: 70,
      alignItems: 'center',
    },
    saveButtonText: { color: theme.colors.primaryText, fontWeight: '600' },
  });
}
