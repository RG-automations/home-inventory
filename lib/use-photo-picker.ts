import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { useTranslation } from 'react-i18next';
import { useAlertInfo } from './confirm';

const PICKER_OPTIONS = {
  quality: 0.6,
  allowsEditing: true,
} as const;

// Zdjecia z aparatu telefonu maja typowo 3000-4000px szerokosci, a w calej
// aplikacji wyswietlamy je jako miniatury 22-140px — bez zmniejszenia
// wymiarow telefon pobiera/wysyla kilkukrotnie wiecej danych niz potrzeba.
// 1600px to komfortowy zapas na najwiekszy podglad w aplikacji (EditItemModal, 140px
// wysokosci, ale pelna szerokosc ekranu), przy nizszym transferze niz oryginal.
const MAX_DIMENSION_PX = 1600;

async function shrinkImage(uri: string): Promise<string> {
  const result = await manipulateAsync(uri, [{ resize: { width: MAX_DIMENSION_PX } }], {
    compress: 0.7,
    format: SaveFormat.JPEG,
  });
  return result.uri;
}

/**
 * Wspolna obsluga wyboru zdjecia (aparat / galeria) wraz z pytaniem o uprawnienia.
 * Zwraca lokalny URI wybranego (i zmniejszonego do MAX_DIMENSION_PX) zdjecia
 * albo null, jesli uzytkownik anulowal lub odmowil uprawnien.
 */
export function usePhotoPicker() {
  const { t } = useTranslation();
  const alertInfo = useAlertInfo();

  async function pickFromLibrary(): Promise<string | null> {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      await alertInfo(t('common.permissionDenied'), t('common.enablePhotoAccess'));
      return null;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      ...PICKER_OPTIONS,
      mediaTypes: ['images'],
    });

    if (result.canceled || !result.assets[0]) return null;
    return shrinkImage(result.assets[0].uri);
  }

  async function takePhoto(): Promise<string | null> {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      await alertInfo(t('common.permissionDenied'), t('common.enableCameraAccess'));
      return null;
    }

    const result = await ImagePicker.launchCameraAsync(PICKER_OPTIONS);

    if (result.canceled || !result.assets[0]) return null;
    return shrinkImage(result.assets[0].uri);
  }

  return { pickFromLibrary, takePhoto };
}
