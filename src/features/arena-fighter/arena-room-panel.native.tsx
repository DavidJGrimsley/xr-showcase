import { Button, Host } from '@expo/ui';
import { useSyncExternalStore } from 'react';
import { ScrollView, Text, View } from 'react-native';
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
  return (
    <ScrollView
      className="my-2 max-w-[320px] rounded-xl p-3"
      style={{ backgroundColor: colors.surface, flexGrow: 0 }}>
      <Text accessibilityLiveRegion="polite" style={{ color: colors.text }}>
        {match.networkMessage || state.message}
      </Text>
      {state.status === 'scanning' && (
        <Host matchContents>
          <Button
            label="Use this space"
            disabled={!state.canFinish}
            onPress={() => void room.finishScan()}
            style={{ height: 52 }}
          />
        </Host>
      )}
      {(state.status === 'error' || match.networkMessage) && (
        <Host matchContents>
          <Button label="Retry connection" onPress={room.retry} style={{ height: 52 }} />
        </Host>
      )}
      {controller.mode === 'host' && match.displayCode && match.stage === 'lobby' && (
        <View className="items-center gap-2 py-2">
          <View className="bg-white p-3">
            <QRCode value={joinLink(match.displayCode.replace(/\s/g, ''))} size={140} />
          </View>
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
  );
}
