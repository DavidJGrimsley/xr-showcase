import { Host, Picker } from '@expo/ui';
import { View } from 'react-native';
import { GameCopy as Text } from '@/ui/game-text';
import { ARENA_FONTS, useArenaColors } from './arena-ui';
import type { MainAudioSource } from './arena-audio-policy';

export default function ArenaAudioPicker({
  value,
  onChange,
}: {
  value: MainAudioSource;
  onChange: (source: MainAudioSource) => void;
}) {
  const colors = useArenaColors();
  return (
    <View
      testID="arena-audio-panel"
      style={{ width: '100%', maxWidth: 520, gap: 8, alignItems: 'center' }}>
      <Text style={{ color: colors.text, fontFamily: ARENA_FONTS.button, textAlign: 'center' }}>
        Main audio
      </Text>
      <View style={{ width: 170, maxWidth: '100%', minHeight: 44 }}>
        <Host
          matchContents={{ vertical: true }}
          ignoreSafeArea="all"
          colorScheme="dark"
          seedColor={colors.primary}
          style={{ width: 170, minHeight: 44 }}>
          <Picker selectedValue={value} onValueChange={onChange} testID="arena-main-audio">
            <Picker.Item label="Host phone" value="host" />
            <Picker.Item label="Guest phone" value="guest" />
            <Picker.Item label="Both phones" value="both" />
          </Picker>
        </Host>
      </View>
      <Text
        style={{
          color: colors.text,
          fontFamily: ARENA_FONTS.body,
          textAlign: 'center',
          fontSize: 14,
        }}>
        Both players must share the same space and have internet. Choose where music and round
        announcements play. Hits and your result play on your own phone.
      </Text>
    </View>
  );
}
