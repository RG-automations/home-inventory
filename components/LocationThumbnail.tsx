import { useEffect, useState } from 'react';
import { Image, Text, type ImageStyle, type StyleProp, type TextStyle } from 'react-native';
import { getLocationPhotoUrl } from '../lib/locations';

type Props = {
  photoPath: string | null;
  style: StyleProp<ImageStyle>;
  fallbackIconStyle: StyleProp<TextStyle>;
};

export default function LocationThumbnail({ photoPath, style, fallbackIconStyle }: Props) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    if (photoPath) {
      getLocationPhotoUrl(photoPath).then((url) => {
        if (isMounted) setSignedUrl(url);
      });
    } else {
      setSignedUrl(null);
    }

    return () => {
      isMounted = false;
    };
  }, [photoPath]);

  if (signedUrl) {
    return <Image source={{ uri: signedUrl }} style={style} />;
  }

  return <Text style={fallbackIconStyle}>📁</Text>;
}
