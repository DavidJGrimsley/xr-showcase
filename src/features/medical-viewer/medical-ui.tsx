import { createContext, useContext, type ReactElement, type ReactNode } from 'react';
import { Platform } from 'react-native';
import { GameButton } from '@/ui/game-button';
import { useGameWindowDimensions } from '@/ui/use-game-window-dimensions';
import { useAppTheme } from '@/theme/provider';
import type { ARControlProps } from '@/features/ar/ar-control.native';

const MedicalWidthContext = createContext<number | null>(null);

export function useMedicalColors() {
  // AR controls share the app's dark palette regardless of the camera image.
  return useAppTheme().colors.dark;
}

export function MedicalWidthProvider({ width, children }: { width: number; children: ReactNode }) {
  return (
    <MedicalWidthContext.Provider value={Math.max(1, width)}>
      {children}
    </MedicalWidthContext.Provider>
  );
}

export function MedicalControl({
  label,
  accessibilityLabel,
  hint,
  selected,
  disabled,
  onPress,
  testID,
  width,
  fontFamily,
  fontSize = 15,
  icon,
  iconOnly = false,
}: ARControlProps & { icon?: ReactElement; iconOnly?: boolean; fontSize?: number }) {
  const colors = useMedicalColors();
  const { width: viewportWidth, fontScale } = useGameWindowDimensions();
  const measuredWidth = useContext(MedicalWidthContext);
  const availableWidth = measuredWidth ?? Math.max(44, Math.min(viewportWidth - 64, 520));
  const choice = selected !== undefined;
  const secondaryAction = label === 'Home' || /^(Reset|Restart|Reposition)/.test(label);
  const filled = choice ? !!selected : !secondaryAction;
  const color = choice ? (selected ? colors.secondary : colors.surface) : colors.primary;
  // Short labels need room for wide glyphs (for example the "m" in Home).
  const glyphWidth = label.length <= 4 ? 0.7 : 0.6;
  const naturalWidth =
    Math.ceil((label.length * fontSize * glyphWidth + 4) * fontScale) +
    (Platform.OS === 'android' ? 24 : 16) +
    (filled ? 0 : 2);
  return (
    <GameButton
      label={label}
      accessibilityLabel={accessibilityLabel}
      hint={hint}
      selected={selected}
      disabled={disabled}
      onPress={onPress}
      testID={testID}
      width={iconOnly ? 44 : Math.max(44, Math.min(width ?? naturalWidth, availableWidth))}
      fontFamily={fontFamily}
      fontSize={fontSize}
      compact
      color={color}
      textColor={filled ? colors.background : colors.text}
      variant={filled ? 'filled' : 'outlined'}
      icon={icon}
      iconOnly={iconOnly}
    />
  );
}
