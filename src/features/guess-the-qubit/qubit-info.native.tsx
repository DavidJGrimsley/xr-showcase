import type { ReactNode } from 'react';
import { BottomSheet, Button, Host, RNHostView } from '@expo/ui';
import { Link } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';
import { useAppTheme } from '@/theme/provider';

const QUANTUM_API_URL = 'https://davidjgrimsley.com/public-facing/api/quantum';

export function QubitInfoButton({ onPress }: { onPress: () => void }) {
  const { activeColors } = useAppTheme();
  return (
    <Pressable
      testID="qubit-info"
      accessibilityRole="button"
      accessibilityLabel="About Guess the Qubit"
      accessibilityHint="Explains the game, Bloch sphere, and circuit"
      onPress={onPress}
      style={({ pressed }) => [styles.iconButton, { opacity: pressed ? 0.5 : 1 }]}>
      <Svg width={26} height={26} viewBox="0 0 26 26" accessible={false}>
        <Circle
          cx={13}
          cy={13}
          r={11}
          stroke={activeColors.primary}
          strokeWidth={1.8}
          fill="none"
        />
        <Circle cx={13} cy={8} r={1.2} fill={activeColors.primary} />
        <Line
          x1={13}
          y1={12}
          x2={13}
          y2={18}
          stroke={activeColors.primary}
          strokeWidth={2}
          strokeLinecap="round"
        />
      </Svg>
    </Pressable>
  );
}

function InfoSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" style={styles.sectionTitle}>
        {title}
      </Text>
      {children}
    </View>
  );
}

function SphereKey({ color, children }: { color: string; children: ReactNode }) {
  return (
    <View style={styles.key}>
      <View style={[styles.keyDot, { backgroundColor: color }]} />
      <Text style={styles.body}>{children}</Text>
    </View>
  );
}

function CircuitDiagram() {
  const { fontScale, width } = useWindowDimensions();
  const stacked = fontScale > 1.3 || width < 360;
  return (
    <View
      accessible
      accessibilityLabel="Circuit: start in zero, rotate around Y by pi over two, then measure along Z. One qubit, one shot."
      style={[styles.circuit, { flexDirection: stacked ? 'column' : 'row' }]}>
      <View style={styles.gate}>
        <Text style={styles.gateTitle}>|0⟩</Text>
        <Text style={styles.gateCaption}>Start</Text>
      </View>
      <Text style={styles.arrow}>{stacked ? '↓' : '→'}</Text>
      <View style={[styles.gate, styles.rotationGate]}>
        <Text style={styles.gateTitle}>Ry(π/2)</Text>
        <Text style={styles.gateCaption}>Rotate 90°</Text>
      </View>
      <Text style={styles.arrow}>{stacked ? '↓' : '→'}</Text>
      <View style={styles.gate}>
        <Text style={styles.gateTitle}>M</Text>
        <Text style={styles.gateCaption}>Measure Z</Text>
      </View>
    </View>
  );
}

export function QubitInfoModal({
  isPresented,
  onDismiss,
}: {
  isPresented: boolean;
  onDismiss: () => void;
}) {
  const { fontScale } = useWindowDimensions();
  return (
    <Host colorScheme="dark" seedColor="#93f5c5" style={styles.sheetHost}>
      <BottomSheet
        testID="qubit-info-modal"
        isPresented={isPresented}
        onDismiss={onDismiss}
        snapPoints={['full']}
        contentPadding={0}
        containerColor="#10191f">
        <RNHostView>
          <View style={styles.sheet} accessibilityViewIsModal onAccessibilityEscape={onDismiss}>
            <View style={styles.header}>
              <Text accessibilityRole="header" style={styles.title}>
                Guess the Qubit
              </Text>
              <Host matchContents colorScheme="dark" seedColor="#93f5c5">
                <Button
                  label="Done"
                  variant="text"
                  onPress={onDismiss}
                  style={{ height: Math.max(48, 17 * fontScale + 20) }}
                />
              </Host>
            </View>
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.content}
              contentInsetAdjustmentBehavior="automatic">
              <InfoSection title="The game">
                <Text style={styles.body}>
                  Pick 0 or 1 before a qubit is measured. You win when your guess matches the
                  result. Your guess doesn’t change the circuit.
                </Text>
              </InfoSection>
              <InfoSection title="The Bloch sphere">
                <Text style={styles.body}>
                  This sphere is a map of one qubit’s state. The direction of the magenta arrow
                  represents that state.
                </Text>
                <View style={styles.legend}>
                  <SphereKey color="#00c8ef">Cyan rings and axes: reference guides.</SphereKey>
                  <SphereKey color="#ef4ebc">Magenta arrow and point: the qubit’s state.</SphereKey>
                </View>
                <Text style={styles.body}>
                  The top is |0⟩ and the bottom is |1⟩. The four equator labels (+, −, +i, −i) mark
                  other states; each gives equal odds of 0 and 1 when measured along Z.
                </Text>
                <Text style={styles.body}>
                  In this demo, the arrow rotates from |0⟩ to the + state on the equator, then moves
                  to the pole matching the measured result. The animation illustrates preparation
                  and measurement; it isn’t a live view inside the processor.
                </Text>
              </InfoSection>
              <InfoSection title="The circuit">
                <CircuitDiagram />
                <Text style={styles.body}>
                  One qubit starts in |0⟩. A Ry(π/2) gate rotates it 90° around Y, creating an equal
                  superposition of 0 and 1. A single Z measurement returns one bit: 0 or 1, ideally
                  with a 50% chance each.
                </Text>
                <View style={styles.modes}>
                  <Text style={styles.modeTitle}>Simulator</Text>
                  <Text style={styles.body}>
                    Quantum API simulates the rotation and measurement.
                  </Text>
                  <Text style={styles.modeTitle}>Hardware Jobs</Text>
                  <Text style={styles.body}>
                    Quantum API sends the circuit to an IBM quantum processor for one shot. Queue
                    times vary, and hardware noise can affect the odds.
                  </Text>
                </View>
              </InfoSection>
              <Link href={QUANTUM_API_URL} asChild>
                <Pressable
                  testID="qubit-info-api-link"
                  accessibilityRole="link"
                  accessibilityLabel="Visit the Quantum API website"
                  style={({ pressed }) => [styles.apiLink, { opacity: pressed ? 0.55 : 1 }]}>
                  <Text style={styles.linkTitle}>Explore the Quantum API ↗</Text>
                  <Text style={styles.linkCaption}>davidjgrimsley.com</Text>
                </Pressable>
              </Link>
            </ScrollView>
          </View>
        </RNHostView>
      </BottomSheet>
    </Host>
  );
}

const styles = StyleSheet.create({
  iconButton: { minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  sheetHost: { position: 'absolute' },
  sheet: { flex: 1, backgroundColor: '#10191f' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 24,
    paddingVertical: 8,
  },
  title: { flex: 1, color: '#f8fafc', fontSize: 22, fontWeight: '700' },
  scroll: { flex: 1 },
  content: {
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
    padding: 24,
    paddingBottom: 32,
    gap: 28,
  },
  section: { gap: 12 },
  sectionTitle: { color: '#f8fafc', fontSize: 19, fontWeight: '700' },
  body: { color: '#cbd5e1', fontSize: 16, lineHeight: 24, flexShrink: 1 },
  legend: { backgroundColor: '#1b2932', borderRadius: 16, padding: 16, gap: 12 },
  key: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  keyDot: { width: 10, height: 10, borderRadius: 5 },
  circuit: { alignItems: 'center', justifyContent: 'center', gap: 6 },
  gate: {
    flexShrink: 1,
    alignItems: 'center',
    backgroundColor: '#1b2932',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 14,
    gap: 4,
  },
  rotationGate: { backgroundColor: '#18372f' },
  gateTitle: { color: '#93f5c5', fontSize: 18, fontWeight: '700', textAlign: 'center' },
  gateCaption: { color: '#cbd5e1', fontSize: 12, textAlign: 'center' },
  arrow: { color: '#64748b', fontSize: 20 },
  modes: { backgroundColor: '#1b2932', borderRadius: 16, padding: 16, gap: 8 },
  modeTitle: { color: '#f8fafc', fontSize: 16, fontWeight: '600' },
  apiLink: { minHeight: 48, borderRadius: 16, backgroundColor: '#18372f', padding: 16, gap: 4 },
  linkTitle: { color: '#93f5c5', fontSize: 16, fontWeight: '600' },
  linkCaption: { color: '#a5beb5', fontSize: 14 },
});
