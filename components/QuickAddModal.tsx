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
import AnimatedPressable from './AnimatedPressable';
import LocationPicker from './LocationPicker';
import UpgradeModal from './UpgradeModal';
import { useAlertInfo } from '../lib/confirm';
import { useDataRefresh } from '../lib/data-refresh';
import { describeError } from '../lib/error-message';
import { createItem } from '../lib/items';
import { uploadPhoto } from '../lib/photos';
import type { Location } from '../lib/locations';
import { useSubscription } from '../lib/subscription-context';
import type { Theme } from '../lib/theme';
import { useTheme } from '../lib/theme-context';
import { usePhotoPicker } from '../lib/use-photo-picker';
import { useReducedMotion } from '../lib/use-reduced-motion';

type Props = {
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
};

export default function QuickAddModal({ visible, onClose, onSaved }: Props) {
  const { t } = useTranslation();
  const alertInfo = useAlertInfo();
  const { notifyChanged } = useDataRefresh();
  const { pickFromLibrary, takePhoto } = usePhotoPicker();
  const theme = useTheme();
  const isReducedMotion = useReducedMotion();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState<Location | null>(null);
  const [isPickerVisible, setIsPickerVisible] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUpgradeVisible, setIsUpgradeVisible] = useState(false);
  const { canAddPhoto } = useSubscription();

  function reset() {
    setPhotoUri(null);
    setName('');
    setDescription('');
    setLocation(null);
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleTakePhoto() {
    if (!canAddPhoto) {
      setIsUpgradeVisible(true);
      return;
    }
    const uri = await takePhoto();
    if (uri) setPhotoUri(uri);
  }

  async function handlePickFromLibrary() {
    if (!canAddPhoto) {
      setIsUpgradeVisible(true);
      return;
    }
    const uri = await pickFromLibrary();
    if (uri) setPhotoUri(uri);
  }

  async function handleSave() {
    if (!name.trim() || !location) return;
    setIsSaving(true);

    try {
      const photoUrl = photoUri ? await uploadPhoto(photoUri) : null;
      await createItem({
        name: name.trim(),
        description: description.trim() || null,
        photoUrl,
        locationId: location.id,
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
    <Modal visible={visible} transparent animationType={isReducedMotion ? 'none' : 'fade'} onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>{t('item.quickAdd')}</Text>

          {photoUri ? (
            <AnimatedPressable onPress={handleTakePhoto}>
              <Image source={{ uri: photoUri }} style={styles.photoPreview} />
            </AnimatedPressable>
          ) : (
            <View style={styles.photoButtons}>
              <AnimatedPressable style={styles.photoButton} onPress={handleTakePhoto}>
                <Text style={styles.photoButtonIcon}>📷</Text>
                <Text style={styles.photoButtonText}>{t('item.takePhoto')}</Text>
              </AnimatedPressable>
              <AnimatedPressable style={styles.photoButton} onPress={handlePickFromLibrary}>
                <Text style={styles.photoButtonIcon}>🖼️</Text>
                <Text style={styles.photoButtonText}>{t('item.fromLibrary')}</Text>
              </AnimatedPressable>
            </View>
          )}

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

          <AnimatedPressable style={styles.locationButton} onPress={() => setIsPickerVisible(true)}>
            <Text style={styles.locationButtonText}>
              {location ? t('item.atLocation', { name: location.name }) : t('item.chooseLocation')}
            </Text>
          </AnimatedPressable>

          <View style={styles.actions}>
            <AnimatedPressable style={styles.cancelButton} onPress={handleClose}>
              <Text>{t('common.cancel')}</Text>
            </AnimatedPressable>
            <AnimatedPressable
              style={styles.saveButton}
              onPress={handleSave}
              disabled={isSaving || !name.trim() || !location}
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

      <LocationPicker
        visible={isPickerVisible}
        onClose={() => setIsPickerVisible(false)}
        onSelect={(selected) => {
          setLocation(selected);
          setIsPickerVisible(false);
        }}
      />

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
      width: '90%',
      maxWidth: 420,
    },
    title: { fontSize: theme.fontSize.lg, fontWeight: '600', marginBottom: theme.spacing.md, color: theme.colors.text },
    photoButtons: { flexDirection: 'row', gap: theme.spacing.md, marginBottom: theme.spacing.md },
    photoButton: {
      flex: 1,
      height: 100,
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.surfaceAlt,
      alignItems: 'center',
      justifyContent: 'center',
    },
    photoButtonIcon: { fontSize: theme.fontSize.xxl, marginBottom: theme.spacing.xs, color: theme.colors.text },
    photoButtonText: { color: theme.colors.textMuted, fontSize: theme.fontSize.sm },
    photoPreview: { width: '100%', height: 160, borderRadius: theme.radius.md, marginBottom: theme.spacing.md },
    input: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.md,
      padding: theme.spacing.md,
      fontSize: theme.fontSize.md,
      marginBottom: theme.spacing.md,
      color: theme.colors.text,
    },
    textArea: { minHeight: 60, textAlignVertical: 'top' },
    locationButton: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.md,
      padding: theme.spacing.md,
      marginBottom: theme.spacing.md,
    },
    locationButtonText: { fontSize: theme.fontSize.md, color: theme.colors.text },
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
