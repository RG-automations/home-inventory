import { useEffect, useMemo, useState } from 'react';
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
import ItemThumbnail from './ItemThumbnail';
import LocationPicker from './LocationPicker';
import UpgradeModal from './UpgradeModal';
import { useAlertInfo } from '../lib/confirm';
import { useDataRefresh } from '../lib/data-refresh';
import { describeError } from '../lib/error-message';
import { uploadItemPhoto, updateItem } from '../lib/items';
import { getLocationById, type Item, type Location } from '../lib/locations';
import { useSubscription } from '../lib/subscription-context';
import type { Theme } from '../lib/theme';
import { useTheme } from '../lib/theme-context';
import { usePhotoPicker } from '../lib/use-photo-picker';
import { useReducedMotion } from '../lib/use-reduced-motion';

type Props = {
  visible: boolean;
  item: Item | null;
  onClose: () => void;
  onSaved: () => void;
};

export default function EditItemModal({ visible, item, onClose, onSaved }: Props) {
  const { t } = useTranslation();
  const alertInfo = useAlertInfo();
  const { notifyChanged } = useDataRefresh();
  const { pickFromLibrary } = usePhotoPicker();
  const theme = useTheme();
  const isReducedMotion = useReducedMotion();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [newPhotoUri, setNewPhotoUri] = useState<string | null>(null);
  const [location, setLocation] = useState<Location | null>(null);
  const [isPickerVisible, setIsPickerVisible] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUpgradeVisible, setIsUpgradeVisible] = useState(false);
  const { canAddPhoto } = useSubscription();

  useEffect(() => {
    if (visible && item) {
      setName(item.name);
      setDescription(item.description ?? '');
      setNewPhotoUri(null);
      getLocationById(item.location_id).then(setLocation);
    }
  }, [visible, item]);

  async function handlePickFromLibrary() {
    // Podmiana istniejacego zdjecia nie zwieksza ich liczby, wiec limit
    // dotyczy tylko dodania zdjecia do przedmiotu, ktory go nie mial.
    const isAddingNewPhoto = !item?.photo_url;
    if (isAddingNewPhoto && !canAddPhoto) {
      setIsUpgradeVisible(true);
      return;
    }

    const uri = await pickFromLibrary();
    if (uri) setNewPhotoUri(uri);
  }

  async function handleSave() {
    if (!item || !name.trim() || !location) return;
    setIsSaving(true);

    try {
      const photoUrl = newPhotoUri ? await uploadItemPhoto(newPhotoUri) : item.photo_url;
      await updateItem({
        id: item.id,
        name: name.trim(),
        description: description.trim() || null,
        photoUrl,
        locationId: location.id,
        oldPhotoPathToDelete: newPhotoUri ? item.photo_url : null,
      });
      notifyChanged();
      onSaved();
      onClose();
    } catch (error) {
      await alertInfo(t('common.error'), describeError(error, t, 'common.changesSaveFailed'));
    } finally {
      setIsSaving(false);
    }
  }

  if (!item) return null;

  return (
    <Modal visible={visible} transparent animationType={isReducedMotion ? 'none' : 'fade'} onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>{t('item.edit')}</Text>

          {newPhotoUri ? (
            <AnimatedPressable onPress={handlePickFromLibrary}>
              <Image source={{ uri: newPhotoUri }} style={styles.photoPreview} />
            </AnimatedPressable>
          ) : (
            <AnimatedPressable style={styles.photoPicker} onPress={handlePickFromLibrary}>
              <ItemThumbnail
                photoPath={item.photo_url}
                style={styles.photoPreview}
                fallbackIconStyle={styles.photoPickerText}
              />
            </AnimatedPressable>
          )}

          <TextInput style={styles.input} placeholder={t('item.name')} value={name} onChangeText={setName} />
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
            <AnimatedPressable style={styles.cancelButton} onPress={onClose}>
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
    photoPicker: {
      height: 140,
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.surfaceAlt,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: theme.spacing.md,
      overflow: 'hidden',
    },
    photoPickerText: { fontSize: theme.fontSize.xxl, color: theme.colors.text },
    photoPreview: { width: '100%', height: 140, borderRadius: theme.radius.md, marginBottom: theme.spacing.md },
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
