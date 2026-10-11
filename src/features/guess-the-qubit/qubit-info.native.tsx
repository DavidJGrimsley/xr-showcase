import { useState, type ReactNode } from 'react';
import { BottomSheet, Button, Column, Host, RNHostView, ScrollView } from '@expo/ui';
import { fillMaxWidth, onSizeChanged } from '@expo/ui/jetpack-compose/modifiers';
import { frame, onGeometryChange } from '@expo/ui/swift-ui/modifiers';
import {
  Linking,
  Platform,
  StyleSheet,
  Text as DiagramText,
  useWindowDimensions,
  View,
} from 'react-native';
import { GameCopy as Text } from '@/ui/game-text';
import { GameButton } from '@/ui/game-button';
import Svg, { Circle, Line } from 'react-native-svg';
import { useAppTheme } from '@/theme/provider';

const QUANTUM_API_URL = 'https://davidjgrimsley.com/public-facing/api/quantum';
const IBM_QUANTUM_LEARNING_URL = 'https://quantum.cloud.ibm.com/learning/en';

export function QubitInfoButton({ onPress }: { onPress: () => void }) {
  const { activeColors } = useAppTheme();
  return (
    <GameButton
      testID="qubit-info"
      label="About Guess the Qubit"
      hint="Explains qubits, the Bloch vector, and the circuit"
      color={activeColors.primary}
      textColor={activeColors.primary}
      variant="text"
      iconOnly
      onPress={onPress}
      icon={
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
      }
    />
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
      <Text style={[styles.body, { flex: 1 }]}>{children}</Text>
    </View>
  );
}

function CircuitDiagram({ width }: { width: number }) {
  const { fontScale } = useWindowDimensions();
  const stacked = fontScale > 1.3 || width < 300;
  return (
    <View
      accessible
      accessibilityLabel="Circuit: start in zero, rotate the Bloch vector around Y by pi over two, then measure along Z. One qubit, one shot."
      style={[styles.circuit, { flexDirection: stacked ? 'column' : 'row' }]}>
      <View style={styles.gate}>
        <DiagramText style={styles.gateTitle}>|0⟩</DiagramText>
        <DiagramText style={styles.gateCaption}>Start</DiagramText>
      </View>
      <DiagramText style={styles.arrow}>{stacked ? '↓' : '→'}</DiagramText>
      <View style={[styles.gate, styles.rotationGate]}>
        <DiagramText style={styles.gateTitle}>Ry(π/2)</DiagramText>
        <DiagramText style={styles.gateCaption}>Rotate 90°</DiagramText>
      </View>
      <DiagramText style={styles.arrow}>{stacked ? '↓' : '→'}</DiagramText>
      <View style={styles.gate}>
        <DiagramText style={styles.gateTitle}>M</DiagramText>
        <DiagramText style={styles.gateCaption}>Measure Z</DiagramText>
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
  const { fontScale, width } = useWindowDimensions();
  const [sheetWidth, setSheetWidth] = useState(0);
  const contentWidth = Math.min(width, sheetWidth || width, 560);
  const measureSheet = ({ width }: { width: number }) => {
    if (width > 0) setSheetWidth(width);
  };
  // RNHostView matchContents measures Yoga content, not the sheet's proposed width.
  // Measure the native viewport and give both RN roots a bounded width and natural height.
  const sheetModifiers =
    Platform.OS === 'ios'
      ? [frame({ maxWidth: Infinity, alignment: 'top' }), onGeometryChange(measureSheet)]
      : [fillMaxWidth(), onSizeChanged(measureSheet)];
  return (
    <Host colorScheme="dark" seedColor="#93f5c5" style={styles.sheetHost}>
      <BottomSheet
        testID="qubit-info-modal"
        isPresented={isPresented}
        onDismiss={onDismiss}
        snapPoints={['full']}
        contentPadding={0}
        containerColor="#10191f">
        <Column alignment="center" spacing={0} modifiers={sheetModifiers}>
          <RNHostView matchContents>
            <View
              style={[styles.header, { width: contentWidth }]}
              onAccessibilityEscape={onDismiss}>
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
          </RNHostView>
          <ScrollView
            testID="qubit-info-scroll"
            direction="vertical"
            style={{ width: contentWidth }}>
            <RNHostView matchContents>
              <View
                style={[styles.content, { width: contentWidth }]}
                onAccessibilityEscape={onDismiss}>
                <InfoSection title="The “game”">
                  <Text style={styles.body}>
                    Pick 0 or 1 before a qubit is measured. You win when your guess matches the
                    result. Your guess doesn’t change the circuit.
                  </Text>
                  <Text style={styles.body}>
                    The word “game” is in quotation marks because this is a parody of how much fun
                    or excitement comes from thinking about quantum mechanics in terms of classical
                    computing: not very much. It is, by definition, a game, but it is meant to be
                    educational rather than fun. This may raise more questions than it answers, but
                    it should serve as a starting point and reference material for beginners.
                  </Text>
                </InfoSection>
                <InfoSection title="What is a Qubit?">
                  <Text style={styles.body}>
                    Quantum mechanics is the framework of quantum physics that describes matter and
                    energy at scales where everyday intuition can fail. A qubit (quantum bit) is
                    quantum computing’s basic unit of information, using two states labeled |0⟩ and
                    |1⟩. A classical bit stores 0 or 1; a qubit can be prepared in a superposition,
                    a quantum combination of those states.
                  </Text>
                  <Text style={styles.body}>
                    Superposition involves wave-like quantities called probability amplitudes, which
                    can reinforce or cancel each other through interference. Quantum computing uses
                    gates to change these states before measurement. A measurement along Z returns
                    one classical bit: 0 or 1. Here, you guess that result; the Bloch sphere
                    visualizes the state that determines its probabilities.
                  </Text>
                </InfoSection>
                <InfoSection title="The Bloch sphere">
                  <Text style={styles.body}>
                    This sphere maps the ideal state of one qubit. A vector has a direction and a
                    length and is often drawn as an arrow. The direction of the magenta vector (or
                    arrow), called the Bloch vector, represents the qubit’s state. In this demo, its
                    length stays fixed and its tip marks a point on the sphere.
                  </Text>
                  <View style={styles.legend}>
                    <SphereKey color="#00c8ef">Cyan rings and axes: reference guides.</SphereKey>
                    <SphereKey color="#ef4ebc">
                      Magenta vector and tip: the qubit’s state.
                    </SphereKey>
                  </View>
                  <Text style={styles.body}>
                    The top is |0⟩ and the bottom is |1⟩. The four equator labels (+, −, +i, −i)
                    mark other states; each gives equal odds of 0 and 1 when measured along Z.
                  </Text>
                  <Text style={styles.body}>
                    In this demo, the Bloch vector rotates from |0⟩ to the + state on the equator,
                    then moves to the pole matching the measured result. The animation illustrates
                    preparation and measurement; it isn’t a live view inside the processor.
                  </Text>
                </InfoSection>
                <InfoSection title="The circuit">
                  <CircuitDiagram width={contentWidth - 48} />
                  <Text style={styles.body}>
                    One qubit starts in |0⟩. A Ry(π/2) gate rotates its Bloch vector 90° around Y,
                    creating an equal superposition of |0⟩ and |1⟩. A single Z measurement returns
                    one bit: 0 or 1, ideally with a 50% chance each.
                  </Text>
                  <View style={styles.modes}>
                    <Text style={styles.modeTitle}>Simulator</Text>
                    <Text style={styles.body}>
                      Quantum API simulates the rotation and measurement.
                    </Text>
                    <Text style={styles.modeTitle}>Hardware</Text>
                    <Text style={styles.body}>
                      Quantum API sends the circuit to an IBM quantum processor for one shot. Queue
                      times vary, and hardware noise can affect the odds.
                    </Text>
                  </View>
                </InfoSection>
                <GameButton
                  testID="qubit-info-api-link"
                  label="Explore the Quantum API ↗"
                  hint="Visit davidjgrimsley.com"
                  color="#18372f"
                  textColor="#93f5c5"
                  width={contentWidth - 48}
                  onPress={() => {
                    void Linking.openURL(QUANTUM_API_URL).catch(() => {});
                  }}
                />
                <GameButton
                  testID="qubit-info-ibm-link"
                  label="Learn with IBM Quantum & Qiskit ↗"
                  hint="Visit quantum.cloud.ibm.com"
                  color="#18372f"
                  textColor="#93f5c5"
                  width={contentWidth - 48}
                  onPress={() => {
                    void Linking.openURL(IBM_QUANTUM_LEARNING_URL).catch(() => {});
                  }}
                />
              </View>
            </RNHostView>
          </ScrollView>
        </Column>
      </BottomSheet>
    </Host>
  );
}

const styles = StyleSheet.create({
  sheetHost: { position: 'absolute' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 24,
    paddingVertical: 8,
  },
  title: { flex: 1, color: '#f8fafc', fontSize: 22, fontWeight: '700' },
  content: {
    alignSelf: 'center',
    padding: 24,
    paddingBottom: 32,
    gap: 28,
  },
  section: { gap: 12 },
  sectionTitle: { color: '#f8fafc', fontSize: 19, fontWeight: '700' },
  body: { color: '#cbd5e1', fontSize: 16, lineHeight: 24 },
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
});
