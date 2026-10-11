import { createContext, useContext, type ReactElement, type ReactNode } from 'react';
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
  icon,
  iconOnly = false,
}: ARControlProps & { icon?: ReactElement; iconOnly?: boolean }) {
  const colors = useMedicalColors();
  const { width: viewportWidth, fontScale } = useGameWindowDimensions();
  const measuredWidth = useContext(MedicalWidthContext);
  const availableWidth = measuredWidth ?? Math.max(48, Math.min(viewportWidth - 72, 520));
  const choice = selected !== undefined;
  const secondaryAction = label === 'Home' || /^(Reset|Restart|Reposition)/.test(label);
  const filled = choice ? !!selected : !secondaryAction;
  const color = choice ? (selected ? colors.secondary : colors.surface) : colors.primary;
  const naturalWidth = Math.ceil(label.length * 16 * fontScale * 0.6) + 32 + (filled ? 0 : 2);
  return (
    <GameButton
      label={label}
      accessibilityLabel={accessibilityLabel}
      hint={hint}
      selected={selected}
      disabled={disabled}
      onPress={onPress}
      testID={testID}
      width={iconOnly ? 48 : Math.max(48, Math.min(width ?? naturalWidth, availableWidth))}
      fontFamily={fontFamily}
      color={color}
      textColor={filled ? colors.background : colors.text}
      variant={filled ? 'filled' : 'outlined'}
      icon={icon}
      iconOnly={iconOnly}
    />
  );
}
