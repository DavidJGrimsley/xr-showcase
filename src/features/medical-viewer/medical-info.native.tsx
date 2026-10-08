import { useState } from 'react';
import { BottomSheet, Button, Column, Host, RNHostView, ScrollView } from '@expo/ui';
import { frame, onGeometryChange } from '@expo/ui/swift-ui/modifiers';
import { fillMaxWidth, onSizeChanged } from '@expo/ui/jetpack-compose/modifiers';
import { Link } from 'expo-router';
import { Platform, Pressable, Text, useWindowDimensions, View } from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';
import { useAppTheme } from '@/theme/provider';
import provenance from '../../../assets/medical/skull-provenance.json';

export function MedicalInfoButton({ onPress }: { onPress: () => void }) {
  const { activeColors: colors } = useAppTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="About the Medical Viewer"
      testID="medical-info"
      onPress={onPress}
      className="min-h-[48px] min-w-[48px] items-center justify-center active:opacity-50">
      <Svg width={26} height={26} viewBox="0 0 26 26" accessible={false}>
        <Circle cx={13} cy={13} r={11} fill="none" stroke={colors.primary} strokeWidth={1.8} />
        <Circle cx={13} cy={8} r={1.2} fill={colors.primary} />
        <Line
          x1={13}
          y1={12}
          x2={13}
          y2={18}
          stroke={colors.primary}
          strokeWidth={2}
          strokeLinecap="round"
        />
      </Svg>
    </Pressable>
  );
}

export function MedicalInfoModal({
  isPresented,
  onDismiss,
}: {
  isPresented: boolean;
  onDismiss: () => void;
}) {
  const { width, fontScale } = useWindowDimensions();
  const [sheetWidth, setSheetWidth] = useState(0);
  const contentWidth = Math.min(width, sheetWidth || width, 560);
  const measure = ({ width }: { width: number }) => {
    if (width > 0) setSheetWidth(width);
  };
  const modifiers =
    Platform.OS === 'ios'
      ? [frame({ maxWidth: Infinity, alignment: 'top' }), onGeometryChange(measure)]
      : [fillMaxWidth(), onSizeChanged(measure)];
  return (
    <Host colorScheme="dark" seedColor="#93f5c5" style={{ position: 'absolute' }}>
      <BottomSheet
        testID="medical-info-modal"
        isPresented={isPresented}
        onDismiss={onDismiss}
        snapPoints={['full']}
        contentPadding={0}
        containerColor="#10191f">
        <Column alignment="center" modifiers={modifiers}>
          <RNHostView matchContents>
            <View
              className="flex-row items-center gap-3 px-6 py-2"
              style={{ width: contentWidth }}
              onAccessibilityEscape={onDismiss}>
              <Text accessibilityRole="header" className="flex-1 text-xl font-bold text-slate-50">
                Medical Viewer
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
          <ScrollView direction="vertical" style={{ width: contentWidth }}>
            <RNHostView matchContents>
              <View
                className="gap-6 p-6 pb-8"
                style={{ width: contentWidth }}
                onAccessibilityEscape={onDismiss}>
                <Text className="text-base leading-6 text-slate-200">
                  Move your phone slowly, then tap a highlighted table or floor. Pinch the skull to
                  resize it, or use − and +. Twist two fingers to rotate it. Labels reveals the
                  anatomy markers.
                </Text>
                <Text className="text-base leading-6 text-slate-200">
                  Reposition lets you choose another surface and keeps your current size and
                  rotation. Restart AR starts a fresh tracking session at the original size and
                  orientation.
                </Text>
                <Text className="text-base leading-6 text-slate-200">
                  This skull was segmented from CT images in 3D Slicer and simplified for the
                  viewer. Brain is unavailable until its separate model is ready.
                </Text>
                <Text selectable className="text-base leading-6 text-slate-200">
                  {provenance.attribution}
                </Text>
                <Link href={provenance.collectionReadme} asChild>
                  <Pressable
                    accessibilityRole="link"
                    className="min-h-[48px] justify-center active:opacity-50">
                    <Text className="text-base text-emerald-200">NLM Additional Head Images ↗</Text>
                  </Pressable>
                </Link>
                <Text className="text-base leading-6 text-slate-200">
                  Educational visualization only. The segmentation and labels are not clinically
                  validated and must not be used for diagnosis or treatment.
                </Text>
              </View>
            </RNHostView>
          </ScrollView>
        </Column>
      </BottomSheet>
    </Host>
  );
}
