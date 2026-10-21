import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Modal, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAlertInfo } from '../lib/confirm';
import { useDataRefresh } from '../lib/data-refresh';
import { describeError } from '../lib/error-message';
import {
  collectSubtreeIds,
  getLocationById,
  moveLocation,
  updateLocation,
  type Location,
} from '../lib/locations';
import { getPhotoUrl, uploadPhoto } from '../lib/photos';
import { useSubscription } from '../lib/subscription-context';
import type { Theme } from '../lib/theme';
import { useTheme } from '../lib/theme-context';
import { usePhotoPicker } from '../lib/use-photo-picker';
import { useReducedMotion } from '../lib/use-reduced-motion';
import AnimatedPressable from './AnimatedPressable';
import LocationPicker from './LocationPicker';
import UpgradeModal from './UpgradeModal';

type Props = {
  visible: boolean;
  location: Location | null;
  onClose: () => void;
  onSaved: () => void;
};

export default function EditLocationModal({ visible, location, onClose, onSaved }: Props) {
  const { t } = useTranslation();
  const alertInfo = useAlertInfo();
  const { notifyChanged } = useDataRefresh();
  const theme = useTheme();
  const isReducedMotion = useReducedMotion();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { pickFromLibrary } = usePhotoPicker();
  const { canAddPhoto } = useSubscription();
  const [name, setName] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [existingPhotoUrl, setExistingPhotoUrl] = useState<string | null>(null);
  const [hasRemovedPhoto, setHasRemovedPhoto] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUpgradeVisible, setIsUpgradeVisible] = useState(false);
  const [parentName, setParentName] = useState<string | null>(null);
  const [newParentId, setNewParentId] = useState<string | null | undefined>(undefined);
  const [excludeIds, setExcludeIds] = useState<string[]>([]);
  const [isMovePickerVisible, setIsMovePickerVisible] = useState(false);

  useEffect(() => {
    if (visible && location) {
      setName(location.name);
      setPhotoUri(null);
      setHasRemovedPhoto(false);
      setNewParentId(undefined);

      if (location.photo_url) {
        getPhotoUrl(location.photo_url).then(setExistingPhotoUrl);
      } else {
        setExistingPhotoUrl(null);
      }

      if (location.parent_id) {
        getLocationById(location.parent_id).then((p) => setParentName(p.name));
      } else {
        setParentName(null);
      }

      collectSubtreeIds(location.id).then(setExcludeIds);
    }
  }, [visible, location]);

  async function handlePickPhoto() {
    // Zamiana istniejacego zdjecia na inne nie zwieksza liczby zdjec,
    // wiec limit dotyczy tylko miejsc, ktore jeszcze zdjecia nie maja.
    if (!canAddPhoto && !location?.photo_url) {
      setIsUpgradeVisible(true);
      return;
    }
    const uri = await pickFromLibrary();
    if (uri) {
      setPhotoUri(uri);
      setHasRemovedPhoto(false);
    }
  }

  function handleRemovePhoto() {
    setPhotoUri(null);
    setExistingPhotoUrl(null);
    setHasRemovedPhoto(true);
  }

  async function handleSave() {
    if (!location || !name.trim()) return;
    setIsSaving(true);

    try {
      const oldPhotoPath = location.photo_url;
      let photoUrl = location.photo_url;

      if (photoUri) {
        photoUrl = await uploadPhoto(photoUri);
      } else if (hasRemovedPhoto) {
        photoUrl = null;
      }

      const photoChanged = photoUrl !== oldPhotoPath;

      await updateLocation({
        id: location.id,
        name: name.trim(),
        photoUrl,
        oldPhotoPathToDelete: photoChanged ? oldPhotoPath : null,
      });

      if (newParentId !== undefined) {
        await moveLocation(location.id, newParentId);
      }

      notifyChanged();
      onSaved();
      onClose();
    } catch (error) {
      await alertInfo(t('common.error'), describeError(error, t, 'common.changesSaveFailed'));
    } finally {
      setIsSaving(false);
    }
  }

  if (!location) return null;

  const previewUri = photoUri ?? existingPhotoUrl;

  return (
    <Modal visible={visible} transparent animationType={isReducedMotion ? 'none' : 'fade'} onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>{t('location.edit')}</Text>

          <AnimatedPressable style={styles.photoPicker} onPress={handlePickPhoto}>
            {previewUri ? (
              <Image source={{ uri: previewUri }} style={styles.photoPreview} />
            ) : (
              <Text style={styles.photoPickerText}>{t('location.addPhoto')}</Text>
            )}
          </AnimatedPressable>

          {previewUri && (
            <AnimatedPressable style={styles.removePhotoButton} onPress={handleRemovePhoto}>
              <Text style={styles.removePhotoText}>{t('location.removePhoto')}</Text>
            </AnimatedPressable>
          )}

          <TextInput
            style={styles.input}
            placeholder={t('location.namePlaceholder')}
            value={name}
            onChangeText={setName}
            autoFocus
          />

          <AnimatedPressable style={styles.locationButton} onPress={() => setIsMovePickerVisible(true)}>
            <Text style={styles.locationButtonText}>
              {t('item.atLocation', { name: parentName ?? t('common.allLocations') })}
            </Text>
          </AnimatedPressable>

          <View style={styles.actions}>
            <AnimatedPressable style={styles.cancelButton} onPress={onClose}>
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

      <LocationPicker
        visible={isMovePickerVisible}
        excludeIds={excludeIds}
        allowRoot
        onClose={() => setIsMovePickerVisible(false)}
        onSelectRoot={() => {
          setNewParentId(null);
          setParentName(null);
          setIsMovePickerVisible(false);
        }}
        onSelect={(selected) => {
          setNewParentId(selected.id);
          setParentName(selected.name);
          setIsMovePickerVisible(false);
        }}
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
      maxWidth: 400,
    },
    title: { fontSize: theme.fontSize.lg, fontWeight: '600', marginBottom: theme.spacing.md, color: theme.colors.text },
    photoPicker: {
      height: 140,
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.surfaceAlt,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: theme.spacing.sm,
      overflow: 'hidden',
    },
    photoPickerText: { color: theme.colors.textMuted, fontSize: theme.fontSize.md },
    photoPreview: { width: '100%', height: '100%' },
    removePhotoButton: { alignSelf: 'center', marginBottom: theme.spacing.md },
    removePhotoText: { color: theme.colors.danger, fontSize: theme.fontSize.sm },
    input: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.md,
      padding: theme.spacing.md,
      fontSize: theme.fontSize.md,
      color: theme.colors.text,
    },
    locationButton: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.md,
      padding: theme.spacing.md,
      marginTop: theme.spacing.md,
    },
    locationButtonText: { fontSize: theme.fontSize.md, color: theme.colors.text },
    actions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      marginTop: theme.spacing.lg,
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
