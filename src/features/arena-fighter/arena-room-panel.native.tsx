import { ActivityIndicator, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import type { MatchSnapshot } from './arena-match';
import { joinLink } from './arena-protocol';
import { arenaInviteLayout } from './arena-hud-state';
import { ARENA_FONTS, ArenaButton, useArenaColors } from './arena-ui';

export default function ArenaRoomPanel({
  match,
  width,
  height,
}: {
  match: MatchSnapshot;
  width: number;
  height: number;
}) {
  const colors = useArenaColors();
  const layout = arenaInviteLayout(width, height);
  if (!match.displayCode) return null;
  return (
    <View
      testID="arena-invite"
      style={{
        width: layout.width,
        maxWidth: '100%',
        minHeight: layout.height,
        padding: layout.padding,
        borderRadius: 20,
        backgroundColor: colors.surface,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 20,
      }}>
      <View
        testID="arena-invite-qr"
        style={{ padding: 12, backgroundColor: 'white', borderRadius: 8, flexShrink: 0 }}>
        <QRCode value={joinLink(match.displayCode.replace(/\s/g, ''))} size={layout.qrSize} />
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 8 }}>
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.6}
          maxFontSizeMultiplier={1.35}
          style={{ color: colors.text, fontFamily: ARENA_FONTS.button, fontSize: 18 }}>
          Scan QR or use code
        </Text>
        <Text
          selectable
          accessibilityLabel={'Room code ' + match.displayCode.split('').join(' ')}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.5}
          maxFontSizeMultiplier={1.35}
          style={{ color: colors.primary, fontFamily: ARENA_FONTS.mono, fontSize: 36 }}>
          {match.displayCode}
        </Text>
        <Text
          numberOfLines={2}
          adjustsFontSizeToFit
          accessibilityLiveRegion="polite"
          maxFontSizeMultiplier={1.35}
          style={{ color: colors.secondary, fontFamily: ARENA_FONTS.body, fontSize: 14 }}>
          {match.rounds === 1 ? '1 round' : 'Best of ' + match.rounds} · Waiting for opponent…
        </Text>
      </View>
    </View>
  );
}

export function ArenaGuidance({
  message,
  loading = false,
  onRetry,
  onRestart,
}: {
  message: string;
  loading?: boolean;
  onRetry?: () => void;
  onRestart?: () => void;
}) {
  const colors = useArenaColors();
  return (
    <View testID="arena-guidance" style={{ maxWidth: 420, alignSelf: 'flex-end', gap: 8 }}>
      <View
        style={{
          backgroundColor: colors.surface,
          borderRadius: 28,
          paddingHorizontal: 18,
          paddingVertical: 12,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
        }}>
        {loading && (
          <ActivityIndicator color={colors.primary} accessibilityLabel="Preparing arena" />
        )}
        <Text
          accessibilityLiveRegion="polite"
          style={{ color: colors.text, fontFamily: ARENA_FONTS.body, fontSize: 15, flexShrink: 1 }}>
          {message}
        </Text>
      </View>
      {(onRetry || onRestart) && (
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}>
          {onRetry && <ArenaButton label="Retry connection" onPress={onRetry} />}
          {onRestart && <ArenaButton label="Restart AR" danger onPress={onRestart} />}
        </View>
      )}
    </View>
  );
}
