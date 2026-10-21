import { useEffect, useState } from 'react';
import { Image, Text, type ImageStyle, type StyleProp, type TextStyle } from 'react-native';
import { getPhotoUrl } from '../lib/photos';

type Props = {
  photoPath: string | null;
  style: StyleProp<ImageStyle>;
  fallbackIconStyle: StyleProp<TextStyle>;
};

export default function ItemThumbnail({ photoPath, style, fallbackIconStyle }: Props) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    if (photoPath) {
      getPhotoUrl(photoPath).then((url) => {
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

  return <Text style={fallbackIconStyle}>📦</Text>;
}
