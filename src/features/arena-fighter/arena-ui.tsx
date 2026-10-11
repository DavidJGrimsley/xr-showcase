import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useFonts } from 'expo-font';
import { useMemo, type ReactNode } from 'react';
import { ImageBackground, Pressable, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop, SvgXml } from 'react-native-svg';
import { useAppTheme } from '@/theme/provider';
import lettering from '../../../assets/arena/ui/lettering.json';

export const ARENA_TITLE = "Neo Rock 'Em Sock 'Em Robots";
export const ARENA_FONTS = {
  body: 'ArenaNotoSans',
  button: 'ArenaNotoSansSemibold',
  serif: 'ArenaNotoSerif',
  mono: 'ArenaNotoMono',
};
const fontAssets = {
  ArenaNotoSans: require('../../../assets/arena/ui/ArenaNotoSans.ttf'),
  ArenaNotoSansSemibold: require('../../../assets/arena/ui/ArenaNotoSansSemibold.ttf'),
  ArenaNotoSerif: require('../../../assets/arena/ui/ArenaNotoSerif.ttf'),
  ArenaNotoMono: require('../../../assets/arena/ui/ArenaNotoMono.ttf'),
};
export function useArenaFonts() {
  return useFonts(fontAssets);
}
export function useArenaColors() {
  return useAppTheme().colors.dark;
}

export function ArenaButton({
  label,
  onPress,
  primary = false,
  secondary = false,
  danger = false,
  disabled = false,
  icon,
  iconOnly = false,
  testID,
}: {
  label: string;
  onPress: () => void;
  primary?: boolean;
  secondary?: boolean;
  danger?: boolean;
  disabled?: boolean;
  icon?: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  iconOnly?: boolean;
  testID?: string;
}) {
  const colors = useArenaColors();
  const filled = primary || secondary || danger;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 48,
        minWidth: 48,
        paddingHorizontal: iconOnly ? 12 : 16,
        paddingVertical: 10,
        borderRadius: 12,
        backgroundColor: danger
          ? '#d99a9a'
          : secondary
            ? colors.secondary
            : primary
              ? colors.primary
              : colors.surface,
        opacity: disabled ? 0.45 : pressed ? 0.7 : 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
      })}>
      {icon && (
        <MaterialCommunityIcons
          name={icon}
          size={iconOnly ? 24 : 20}
          color={filled ? colors.background : colors.text}
        />
      )}
      {!iconOnly && (
        <Text
          style={{
            color: filled ? colors.background : colors.text,
            fontFamily: ARENA_FONTS.button,
            fontSize: 16,
          }}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

type LetteringRole = keyof typeof lettering;
export function ArenaDisplayText({
  text,
  role = 'SecondaryTitleFont',
  height = 72,
  maxWidth = 640,
}: {
  text: string;
  role?: LetteringRole;
  height?: number;
  maxWidth?: number;
}) {
  const colors = useArenaColors();
  const entry = (lettering[role] as Record<string, { svg: string; width: number; height: number }>)[
    text
  ];
  const xml = useMemo(
    () =>
      entry?.svg
        .replaceAll('__PRIMARY__', colors.primary)
        .replaceAll('__SECONDARY__', colors.secondary),
    [entry, colors.primary, colors.secondary]
  );
  const width = Math.min(maxWidth, entry ? (height * entry.width) / entry.height : maxWidth);
  const fittedHeight = entry ? (width * entry.height) / entry.width : height;
  return (
    <View
      accessible
      accessibilityRole="header"
      accessibilityLabel={text}
      accessibilityLiveRegion="polite"
      pointerEvents="none"
      style={{ backgroundColor: 'transparent' }}>
      {xml ? (
        <SvgXml
          xml={xml}
          width={width}
          height={fittedHeight}
          style={{ backgroundColor: 'transparent' }}
        />
      ) : (
        <Text style={{ color: colors.text, fontFamily: ARENA_FONTS.button, fontSize: height / 2 }}>
          {text}
        </Text>
      )}
    </View>
  );
}

export function ArenaMenuBackground({ children }: { children: ReactNode }) {
  return (
    <ImageBackground
      source={require('../../../assets/arena/ui/menu-background.png')}
      resizeMode="cover"
      style={{ flex: 1 }}>
      <Svg
        pointerEvents="none"
        width="100%"
        height="100%"
        style={{ position: 'absolute', inset: 0 }}>
        <Defs>
          <LinearGradient id="arenaHorizontal" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor="black" stopOpacity="0.95" />
            <Stop offset="0.08" stopColor="black" stopOpacity="0" />
            <Stop offset="0.92" stopColor="black" stopOpacity="0" />
            <Stop offset="1" stopColor="black" stopOpacity="0.95" />
          </LinearGradient>
          <LinearGradient id="arenaVertical" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="black" stopOpacity="0.95" />
            <Stop offset="0.08" stopColor="black" stopOpacity="0" />
            <Stop offset="0.92" stopColor="black" stopOpacity="0" />
            <Stop offset="1" stopColor="black" stopOpacity="0.95" />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#arenaHorizontal)" />
        <Rect width="100%" height="100%" fill="url(#arenaVertical)" />
      </Svg>
      {children}
    </ImageBackground>
  );
}
