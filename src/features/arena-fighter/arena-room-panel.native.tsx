import { Share, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GameText } from '@/ui/game-text';
import { GameProgress } from '@/ui/game-progress';
import QRCode from 'react-native-qrcode-svg';
import type { MatchSnapshot } from './arena-match';
import { inviteLink } from './arena-invite';
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
  const link = inviteLink({ code: match.displayCode.replace(/\s/g, ''), space: match.space });
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
        <QRCode value={link} size={layout.qrSize} />
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
          {match.rounds === 1 ? '1 round' : 'Best of ' + match.rounds} ·{' '}
          {match.peerConnected ? 'Opponent connected' : 'Waiting for opponent…'}
        </Text>
        {match.space === 'remote' && (
          <ArenaButton
            label="Share invite"
            onPress={() => {
              void Share.share({ message: 'Join my long-distance arena match: ' + link }).catch(
                () => {}
              );
            }}
          />
        )}
      </View>
    </View>
  );
}

export function ArenaGuidance({
  message,
  loading = false,
  onRetry,
  onRestart,
  width,
}: {
  message: string;
  loading?: boolean;
  onRetry?: () => void;
  onRestart?: () => void;
  width?: number;
}) {
  const colors = useArenaColors();
  const viewport = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const panelWidth = Math.max(
    1,
    Math.min(420, width ?? viewport.width - Math.max(12, insets.left) - Math.max(12, insets.right))
  );
  return (
    <View
      testID="arena-guidance"
      pointerEvents="box-none"
      style={{ width: panelWidth, maxWidth: '100%', alignSelf: 'flex-end', gap: 8 }}>
      <View
        pointerEvents="none"
        testID="arena-scan-guidance"
        style={{
          backgroundColor: colors.surface,
          borderRadius: 28,
          paddingHorizontal: 18,
          paddingVertical: 12,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
        }}>
        {loading && <GameProgress color={colors.primary} label="Preparing arena" />}
        <GameText
          accessibilityLiveRegion="polite"
          color={colors.text}
          fontFamily={ARENA_FONTS.body}
          fontSize={15}
          // A definite width breaks the native text/Yoga intrinsic-size loop.
          style={{ width: Math.max(1, panelWidth - 36 - (loading ? 34 : 0)) }}>
          {message}
        </GameText>
      </View>
      {(onRetry || onRestart) && (
        <View
          pointerEvents="box-none"
          style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 8 }}>
          {onRetry && <ArenaButton label="Retry connection" onPress={onRetry} />}
          {onRestart && <ArenaButton label="Restart AR" danger onPress={onRestart} />}
        </View>
      )}
    </View>
  );
}
