import { Button, Host } from '@expo/ui';
import { useSyncExternalStore } from 'react';
import { ScrollView, Text, View, useWindowDimensions } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { useAppTheme } from '@/theme/provider';
import type { ArenaRoom } from './arena-room.native';
import type { ArenaMatch } from './arena-match';
import { joinLink } from './arena-protocol';

export default function ArenaRoomPanel({
  room,
  controller,
}: {
  room: ArenaRoom;
  controller: ArenaMatch;
}) {
  const state = useSyncExternalStore(room.subscribe, room.getSnapshot);
  const match = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
  const { activeColors: colors } = useAppTheme();
  const { height, fontScale } = useWindowDimensions();
  const scanning = state.status === 'scanning';
  const progress = Math.round(state.scanProgress * 100);
  const buttonHeight = Math.max(48, 44 * fontScale);
  const moveable = controller.mode === 'host' && !!state.preview && !match.sharedPlacement;
  return (
    <View
      className="my-2 gap-2 self-end rounded-xl p-3"
      style={{
        backgroundColor: colors.surface,
        width: Math.min(280 * fontScale, 340),
        maxWidth: '100%',
        maxHeight: height * 0.65,
        flexShrink: 1,
      }}>
      {(scanning || state.status === 'placing') && (
        <View className="flex-row items-center justify-between gap-2">
          <Text accessibilityRole="header" className="font-semibold" style={{ color: colors.text }}>
            {scanning ? 'Share the arena' : 'Place the arena'}
          </Text>
          {scanning && <Text style={{ color: colors.text }}>{progress}%</Text>}
        </View>
      )}
      <ScrollView style={{ flexGrow: 0, flexShrink: 1 }} contentContainerClassName="gap-2">
        <Text accessibilityLiveRegion="polite" style={{ color: colors.text }}>
          {match.networkMessage || state.message}
        </Text>
        {scanning && (
          <View
            accessibilityRole="progressbar"
            accessibilityLabel="Shared arena capture"
            accessibilityValue={{ min: 0, max: 100, now: progress }}
            className="overflow-hidden rounded-full"
            style={{
              backgroundColor: colors.background,
              height: 4,
              minHeight: 4,
              maxHeight: 4,
              flexShrink: 0,
            }}>
            <View style={{ width: `${progress}%`, height: 4, backgroundColor: colors.primary }} />
          </View>
        )}
        {controller.mode === 'host' && match.displayCode && match.stage === 'lobby' && (
          <View className="items-center gap-2 py-2">
            {!match.peerConnected && (
              <View className="bg-white p-3">
                <QRCode value={joinLink(match.displayCode.replace(/\s/g, ''))} size={140} />
              </View>
            )}
            <Text
              selectable
              accessibilityLabel={'Room code ' + match.displayCode.split('').join(' ')}
              style={{ color: colors.text, fontSize: 24, fontWeight: '700' }}>
              {match.displayCode}
            </Text>
            <Text style={{ color: colors.text }}>
              {match.rounds === 1 ? '1 round' : 'Best of ' + match.rounds} · Share with one opponent
            </Text>
          </View>
        )}
      </ScrollView>
      {scanning && (
        <Host
          colorScheme="dark"
          seedColor={colors.primary}
          style={{ height: buttonHeight, flexShrink: 0 }}>
          <Button
            label="Create room"
            disabled={!state.canFinish}
            onPress={() => void room.finishScan()}
            style={{ height: buttonHeight, width: '100%' }}
          />
        </Host>
      )}
      {(state.status === 'error' || match.networkMessage) && (
        <Host
          colorScheme="dark"
          seedColor={colors.primary}
          style={{ height: buttonHeight, flexShrink: 0 }}>
          <Button
            label="Retry connection"
            onPress={room.retry}
            style={{ height: buttonHeight, width: '100%' }}
          />
        </Host>
      )}
      {moveable && state.status !== 'hosting' && (
        <Host
          colorScheme="dark"
          seedColor={colors.primary}
          style={{ height: buttonHeight, flexShrink: 0 }}>
          <Button
            label="Move arena"
            variant="outlined"
            onPress={room.reposition}
            style={{ height: buttonHeight, width: '100%' }}
          />
        </Host>
      )}
    </View>
  );
}
