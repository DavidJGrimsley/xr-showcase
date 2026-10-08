import { Link } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { appSnapshot } from '@/data/mock-app';
import { experiences } from '@/features/experiences/experience-catalog';
import { useAppTheme } from '@/theme/provider';

export default function HomeScreen() {
  const { activeColors: colors } = useAppTheme();
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      className="flex-1"
      contentInsetAdjustmentBehavior="automatic"
      contentContainerClassName="grow items-center justify-center px-5 py-8"
      contentContainerStyle={{
        paddingBottom: Math.max(32, insets.bottom),
        paddingLeft: Math.max(20, insets.left),
        paddingRight: Math.max(20, insets.right),
      }}
      style={{ backgroundColor: colors.background }}>
      <View className="w-full max-w-[720px] gap-8">
        <View className="gap-3">
          <Text
            accessibilityRole="header"
            className="text-3xl font-bold"
            style={{ color: colors.text }}>
            {appSnapshot.name}
          </Text>
          <Text className="text-base leading-6" style={{ color: colors.text }}>
            {appSnapshot.audience}
          </Text>
        </View>

        <View className="gap-4">
          {experiences.map((experience) => (
            <Link key={experience.route} href={experience.href} asChild>
              <Pressable
                accessibilityLabel={`Open ${experience.title}`}
                accessibilityRole="button"
                className="min-h-[88px] w-full flex-row items-center gap-4 rounded-xl border p-6 active:opacity-70 focus:border-2"
                style={{
                  backgroundColor: colors.surface,
                  borderColor: colors.primary,
                  borderCurve: 'continuous',
                }}>
                <Text className="flex-1 text-xl font-semibold" style={{ color: colors.text }}>
                  {experience.title}
                </Text>
                <Text
                  accessible={false}
                  aria-hidden
                  className="text-2xl"
                  style={{ color: colors.primary }}>
                  ›
                </Text>
              </Pressable>
            </Link>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}
