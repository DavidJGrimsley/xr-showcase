import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import type { ComponentProps, ReactNode } from 'react';
import { Linking, ScrollView, View, useWindowDimensions } from 'react-native';
import { GameCopy as Text } from '@/ui/game-text';
import { GameButton } from '@/ui/game-button';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ARENA_FONTS, ARENA_TITLE, useArenaColors } from './arena-ui';

export const ARENA_CREDITS = [
  { role: 'Game developer', name: 'David J. Grimsley', href: 'https://davidjgrimsley.com/' },
  {
    role: 'Robot model & animations',
    name: 'Radical Robots — Mike · Tacko3D',
    href: 'https://www.fab.com/listings/c366c6f1-a0af-4083-8d16-0a08ead490c7',
  },
  { role: 'Sound effects', name: 'S1gnal', href: 'https://s1gnal-streams.itch.io/' },
  {
    role: 'Background music',
    name: 'Dire Black Audio',
    href: 'https://www.direblackaudio.com/',
  },
  {
    role: 'AR & shared spaces',
    name: 'ViroReact · ReactVision',
    href: 'https://viro-community.readme.io/',
  },
  { role: 'App framework', name: 'Expo', href: 'https://expo.dev/' },
  { role: 'Icons', name: 'Font Awesome & Material Design Icons', href: 'https://icons.expo.fyi/' },
] as const;

function Section({ title, children }: { title: string; children: ReactNode }) {
  const colors = useArenaColors();
  return (
    <View style={{ gap: 8 }}>
      <Text
        accessibilityRole="header"
        style={{ color: colors.secondary, fontFamily: ARENA_FONTS.button, fontSize: 20 }}>
        {title}
      </Text>
      {children}
    </View>
  );
}

function Body({ children }: { children: ReactNode }) {
  const colors = useArenaColors();
  return (
    <Text
      style={{ color: colors.text, fontFamily: ARENA_FONTS.body, fontSize: 16, lineHeight: 25 }}>
      {children}
    </Text>
  );
}

function Control({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: ComponentProps<typeof MaterialCommunityIcons>['name'];
  children: ReactNode;
}) {
  const colors = useArenaColors();
  return (
    <View style={{ flexDirection: 'row', gap: 14, alignItems: 'flex-start' }}>
      <View accessible={false} style={{ width: 34, alignItems: 'center', paddingTop: 2 }}>
        {icon ? (
          <MaterialCommunityIcons name={icon} size={28} color={colors.secondary} />
        ) : (
          <FontAwesome6 name="hand-fist" size={28} color={colors.secondary} />
        )}
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={{ color: colors.text, fontFamily: ARENA_FONTS.button, fontSize: 17 }}>
          {title}
        </Text>
        <Body>{children}</Body>
      </View>
    </View>
  );
}

export default function ArenaMenuPage({ page }: { page: 'how' | 'info' }) {
  const colors = useArenaColors();
  const insets = useSafeAreaInsets();
  const { fontScale, width } = useWindowDimensions();
  const contentWidth = Math.max(
    1,
    Math.min(660, width - Math.max(20, insets.left) - Math.max(20, insets.right))
  );
  return (
    <ScrollView
      testID={`arena-${page}-page`}
      style={{ flex: 1, marginTop: Math.max(76, insets.top + 44 + 24 * fontScale) }}
      contentContainerStyle={{
        alignItems: 'center',
        paddingLeft: Math.max(20, insets.left),
        paddingRight: Math.max(20, insets.right),
        paddingBottom: Math.max(20, insets.bottom),
      }}>
      <View
        style={{
          width: contentWidth,
          alignSelf: 'center',
          gap: 22,
          padding: 20,
          borderRadius: 16,
          backgroundColor: '#09090be8',
        }}>
        <Text
          accessibilityRole="header"
          style={{ color: colors.text, fontFamily: ARENA_FONTS.button, fontSize: 28 }}>
          {page === 'how' ? 'How to Play' : 'About the game'}
        </Text>
        {page === 'how' ? (
          <>
            <Section title="Set up your ringside seat">
              <Body>
                Choose 1 Player to fight the computer, or 2 Players to challenge a friend. Pick one
                round, best of three, or best of five.
              </Body>
              <Body>
                Move your phone slowly to scan a table or floor, then tap a highlighted surface to
                place the arena. Use Swap Sides to choose your corner and Transform to adjust your
                view. Tap Ready when you’re set.
              </Body>
              <Body>
                For two players, choose Same table to align both phones with one arena, or Long
                distance to place your own arena wherever you are. The host shares a link, QR or
                invite code. Both players tap Ready before each round. Internet is required.
              </Body>
            </Section>
            <Section title="Move, defend, strike">
              <Control title="Circle left / right" icon="rotate-left">
                Hold a curved arrow to circle your opponent. Release to stop.
              </Control>
              <Control title="Advance" icon="arrow-right">
                Hold the right arrow to move closer and get within punching range.
              </Control>
              <Control title="Jump Back" icon="chevron-double-left">
                Tap the double left arrow to hop away and make some space.
              </Control>
              <Control title="Punch" icon="boxing-glove">
                Tap the glove to throw a punch. Get close enough to connect!
              </Control>
              <Control title="Block" icon="shield">
                Hold the shield to guard. Blocking uses the purple guard bar, so let go to recover.
              </Control>
              <Control title="Uppercut">
                Land three punches that get past your opponent’s guard. The tall fist button counts
                your progress: 1/3, 2/3, then 3/3. When it glows, tap it quickly to launch a
                powerful Uppercut! The opening is brief; if you miss it, build up another three
                hits. Taking a hit resets your progress, so keep your guard up between punches.
              </Control>
            </Section>
            <Section title="Win the fight">
              <Body>
                Empty your opponent’s health bar to win a round. Win the most rounds to take the
                match. A draw replays the same round.
              </Body>
              <Body>
                You can move and attack together with both thumbs. Mix punches, movement, and
                well-timed blocks to find an opening.
              </Body>
            </Section>
          </>
        ) : (
          <>
            <Section title={ARENA_TITLE}>
              <Body>
                A pocket-sized robot boxing arena, brought into your room with augmented reality.
                Play against the computer or face a friend nearby or from far away.
              </Body>
            </Section>
            <Section title="How the arena stays in place">
              <Body>
                Your phone’s camera recognizes a table or floor and keeps the virtual arena anchored
                there as you move around. Good lighting and a surface with visible detail help it
                settle into place.
              </Body>
              <Body>
                Same table aligns both phones with the same surroundings. Long distance lets each
                player place and adjust their own arena while sharing the same fight. The host
                shares an invite in either mode. Keep both phones connected and use the same app
                version.
              </Body>
            </Section>
            <Section title="Made possible by">
              {ARENA_CREDITS.map((credit) => (
                <View key={credit.role} style={{ gap: 4 }}>
                  <Text style={{ color: '#cbd5e1', fontFamily: ARENA_FONTS.body, fontSize: 14 }}>
                    {credit.role}
                  </Text>
                  <GameButton
                    label={`${credit.name} ↗`}
                    width={contentWidth - 40}
                    hint={`Visit ${credit.role}: ${credit.name}`}
                    variant="text"
                    color={colors.primary}
                    textColor={colors.primary}
                    fontFamily={ARENA_FONTS.button}
                    onPress={() => {
                      void Linking.openURL(credit.href).catch(() => {});
                    }}
                  />
                </View>
              ))}
            </Section>
          </>
        )}
      </View>
    </ScrollView>
  );
}
