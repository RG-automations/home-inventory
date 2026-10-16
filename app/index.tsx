import { View } from 'react-native';
import LocationBrowser from '../components/LocationBrowser';
import { useTheme } from '../lib/theme-context';

export default function HomeScreen() {
  const theme = useTheme();

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <LocationBrowser locationId={null} />
    </View>
  );
}
