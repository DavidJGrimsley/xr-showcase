import { Button, Column, Host } from '@expo/ui';
import { ActivityIndicator, Text, useWindowDimensions, View } from 'react-native';

import { useAppTheme } from '@/theme/provider';

interface ARStatusPanelProps {
  title: string;
  message: string;
  loading?: boolean;
  actions?: { label: string; onPress: () => void }[];
}

export default function ARStatusPanel({ title, message, loading, actions }: ARStatusPanelProps) {
  const { activeColors: colors } = useAppTheme();
  const { fontScale } = useWindowDimensions();

  return (
    <View className="gap-4 rounded-xl p-5" style={{ backgroundColor: colors.surface }}>
      {loading ? <ActivityIndicator color={colors.primary} accessibilityLabel={title} /> : null}
      <Text
        accessibilityRole="header"
        className="text-xl font-semibold"
        style={{ color: colors.text }}>
        {title}
      </Text>
      <Text
        accessibilityLiveRegion="polite"
        selectable
        className="text-base leading-6"
        style={{ color: colors.text }}>
        {message}
      </Text>
      {actions?.length ? (
        <Host matchContents={{ vertical: true }} colorScheme="dark" seedColor={colors.primary}>
          <Column spacing={8}>
            {actions.map((action) => (
              <Button
                key={action.label}
                label={action.label}
                onPress={action.onPress}
                style={{
                  height: Math.max(48, Math.ceil(20 * fontScale) + 28),
                  paddingHorizontal: 16,
                  paddingVertical: 14,
                }}
              />
            ))}
          </Column>
        </Host>
      ) : null}
    </View>
  );
}
