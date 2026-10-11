import { Button, Host, RNHostView, Row, Text } from '@expo/ui';
import type { ReactElement } from 'react';
import { Platform, useWindowDimensions, View } from 'react-native';

export interface GameButtonProps {
  label: string;
  accessibilityLabel?: string;
  onPress: () => void;
  color: string;
  textColor: string;
  fontFamily?: string;
  fontSize?: number;
  disabled?: boolean;
  selected?: boolean;
  hint?: string;
  icon?: ReactElement;
  iconOnly?: boolean;
  testID?: string;
  width?: number;
  variant?: 'filled' | 'outlined' | 'text';
}

/** One native button API for the home screen and both games. */
export function GameButton({
  label,
  accessibilityLabel = label,
  onPress,
  color,
  textColor,
  fontFamily,
  fontSize = 16,
  disabled = false,
  selected,
  hint,
  icon,
  iconOnly = false,
  testID,
  width,
  variant = 'filled',
}: GameButtonProps) {
  const { fontScale } = useWindowDimensions();
  const borderWidth = variant === 'outlined' ? 1 : 0;
  const buttonWidth = iconOnly ? 48 : width;
  const labelWidth =
    width !== undefined ? Math.max(1, width - 32 - 2 * borderWidth - (icon ? 30 : 0)) : undefined;
  const lines =
    labelWidth && !iconOnly
      ? Math.max(1, Math.ceil((label.length * fontSize * fontScale * 0.6) / labelWidth))
      : 1;
  const height = Math.max(48, Math.ceil(fontSize * fontScale * lines * 1.2) + 24);
  const activate = disabled ? undefined : onPress;
  const nativeAccessibility = Platform.OS !== 'web';
  // SDK 57's universal Button has no accessibility label/state props. Group the
  // native control in an accessible RN element, while retaining the web button.
  return (
    <View
      accessible={nativeAccessibility}
      accessibilityRole={nativeAccessibility ? 'button' : undefined}
      accessibilityLabel={nativeAccessibility ? accessibilityLabel : undefined}
      accessibilityHint={nativeAccessibility ? hint : undefined}
      accessibilityState={
        nativeAccessibility
          ? { disabled, ...(selected !== undefined ? { selected } : {}) }
          : undefined
      }
      onAccessibilityTap={nativeAccessibility ? activate : undefined}
      accessibilityActions={
        nativeAccessibility ? (disabled ? [] : [{ name: 'activate' }]) : undefined
      }
      onAccessibilityAction={
        nativeAccessibility
          ? (event) => {
              if (event.nativeEvent.actionName === 'activate') activate?.();
            }
          : undefined
      }
      style={{
        minWidth: 48,
        minHeight: height,
        borderWidth,
        borderColor: color,
        borderRadius: 12,
        ...(buttonWidth !== undefined ? { width: buttonWidth } : {}),
      }}>
      <Host
        matchContents
        ignoreSafeArea="all"
        colorScheme="dark"
        seedColor={color}
        accessibilityElementsHidden={Platform.OS !== 'web'}
        importantForAccessibility={Platform.OS === 'web' ? 'auto' : 'no-hide-descendants'}>
        <Button
          testID={testID}
          disabled={disabled}
          onPress={activate}
          variant="text"
          style={{
            height: height - 2 * borderWidth,
            width: buttonWidth !== undefined ? buttonWidth - 2 * borderWidth : undefined,
            // Compose TextButton adds its own 12dp horizontal content padding.
            paddingHorizontal: iconOnly ? 0 : Platform.OS === 'android' ? 4 : 16,
            borderRadius: 12,
            backgroundColor: variant === 'filled' ? color : 'transparent',
            opacity: disabled ? 0.45 : 1,
          }}>
          <Row spacing={iconOnly ? 0 : 6} alignment="center">
            {icon ? <RNHostView matchContents>{icon}</RNHostView> : null}
            <Text
              // Keep an accessible name for icon-only buttons on web.
              style={
                iconOnly
                  ? { width: 0, height: 0, opacity: 0 }
                  : labelWidth
                    ? { width: labelWidth }
                    : undefined
              }
              textStyle={{
                fontFamily,
                // SwiftUI custom fonts scale natively; explicit system sizes do not.
                fontSize: Platform.OS === 'ios' && !fontFamily ? fontSize * fontScale : fontSize,
                fontWeight: '600',
                color: textColor,
                textAlign: 'center',
              }}>
              {label}
            </Text>
          </Row>
        </Button>
      </Host>
    </View>
  );
}
