import { ScrollView, View, useWindowDimensions } from 'react-native';
import { GameCopy as Text } from '@/ui/game-text';
import { GameProgress } from '@/ui/game-progress';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ARENA_FONTS, ArenaButton, ArenaMenuBackground, useArenaColors } from './arena-ui';

/** Pre-camera startup keeps the menu artwork and a usable way back. */
export default function ArenaLoadingScreen({
  title,
  message,
  onBack,
}: {
  title: string;
  message: string;
  onBack: () => void;
}) {
  const colors = useArenaColors();
  const insets = useSafeAreaInsets();
  const { fontScale, height } = useWindowDimensions();
  const topSpace = Math.max(68, insets.top + 44 + 24 * fontScale);
  return (
    <ArenaMenuBackground>
      <ScrollView
        testID="arena-loading-screen"
        style={{ flex: 1, marginTop: topSpace, marginBottom: Math.max(10, insets.bottom) }}
        contentContainerStyle={{
          flexGrow: 1,
          alignItems: 'center',
          justifyContent: 'center',
          paddingTop: 16,
          paddingBottom:
            height >= 360 ? Math.max(16, topSpace - Math.max(10, insets.bottom) + 16) : 16,
          paddingLeft: Math.max(24, insets.left),
          paddingRight: Math.max(24, insets.right),
        }}>
        <View
          style={{
            width: '100%',
            maxWidth: 440,
            padding: 20,
            gap: 12,
            borderRadius: 16,
            backgroundColor: '#09090be8',
            alignItems: 'center',
          }}>
          <GameProgress large color={colors.primary} label={title} />
          <Text
            accessibilityRole="header"
            style={{
              color: colors.text,
              fontFamily: ARENA_FONTS.button,
              fontSize: 22,
              textAlign: 'center',
            }}>
            {title}
          </Text>
          <Text
            accessibilityLiveRegion="polite"
            style={{
              color: colors.text,
              fontFamily: ARENA_FONTS.body,
              fontSize: 16,
              lineHeight: 24,
              textAlign: 'center',
            }}>
            {message}
          </Text>
        </View>
      </ScrollView>
      <View
        style={{
          position: 'absolute',
          top: Math.max(10, insets.top),
          left: Math.max(12, insets.left),
        }}>
        <ArenaButton label="Back" icon="arrow-left" onPress={onBack} />
      </View>
    </ArenaMenuBackground>
  );
}
