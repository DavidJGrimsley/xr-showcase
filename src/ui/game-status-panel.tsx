import { View } from 'react-native';
import { useAppTheme } from '@/theme/provider';
import type { ARStatusPanelModel } from '@/features/ar/ar-session-types';
import { GameButton } from './game-button';
import { GameText } from './game-text';
import { GameProgress } from './game-progress';

export function GameStatusPanel({ title, message, loading, actions }: ARStatusPanelModel) {
  const { activeColors: colors } = useAppTheme();
  return (
    <View style={{ padding: 20, gap: 16, borderRadius: 16, backgroundColor: colors.surface }}>
      {loading ? <GameProgress color={colors.primary} label={title} /> : null}
      <GameText color={colors.text} fontSize={22} bold accessibilityRole="header">
        {title}
      </GameText>
      <GameText color={colors.text} lineHeight={24} accessibilityLiveRegion="polite">
        {message}
      </GameText>
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
          />
        ))}
      </View>
    </View>
  );
}
