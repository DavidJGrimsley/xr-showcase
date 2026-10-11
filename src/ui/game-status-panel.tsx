import { Text, View } from 'react-native';
import { useAppTheme } from '@/theme/provider';
import type { ARStatusPanelModel } from '@/features/ar/ar-session-types';
import { GameButton } from './game-button';
import { GameText } from './game-text';
import { GameProgress } from './game-progress';
import { useGameWindowDimensions } from './use-game-window-dimensions';

export function GameStatusPanel({
  title,
  message,
  loading,
  actions,
  selectableMessage = false,
}: ARStatusPanelModel & { selectableMessage?: boolean }) {
  const { activeColors: colors } = useAppTheme();
  const { width, fontScale } = useGameWindowDimensions();
  return (
    <View style={{ padding: 20, gap: 16, borderRadius: 16, backgroundColor: colors.surface }}>
      {loading ? <GameProgress color={colors.primary} label={title} /> : null}
      <GameText color={colors.text} fontSize={22} bold accessibilityRole="header">
        {title}
      </GameText>
      {selectableMessage ? (
        <Text
          selectable
          accessibilityLiveRegion="polite"
          style={{ fontSize: 16, lineHeight: 24, color: colors.text }}>
          {message}
        </Text>
      ) : (
        <GameText color={colors.text} lineHeight={24} accessibilityLiveRegion="polite">
          {message}
        </GameText>
      )}
      <View
        testID="game-status-actions"
        style={{
          gap: 12,
          flexDirection: 'row',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        {actions?.map((action) => (
          <GameButton
            key={action.label}
            label={action.label}
            color={colors.primary}
            textColor={colors.background}
            onPress={action.onPress}
            width={Math.max(
              48,
              Math.min(Math.ceil(action.label.length * 16 * fontScale * 0.6) + 32, width - 80, 520)
            )}
          />
        ))}
      </View>
    </View>
  );
}
