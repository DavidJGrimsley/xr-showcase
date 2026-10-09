import type { ConfigContext, ExpoConfig } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => {
  const apiKey = process.env.RV_API_KEY;
  const projectId = process.env.RV_PROJECT_ID ?? 'f3eab820-8174-4b7b-a79e-854dab36e16a';
  const configured = !!apiKey;
  return {
    ...config,
    name: config.name ?? 'XR Showcase',
    slug: config.slug ?? 'xr-showcase',
    plugins: [
      ...(config.plugins ?? []).map((plugin) =>
        Array.isArray(plugin) && plugin[0] === '@reactvision/react-viro'
          ? ([
              plugin[0],
              {
                ...plugin[1],
                provider: configured ? 'reactvision' : 'none',
                ...(configured ? { rvApiKey: apiKey, rvProjectId: projectId } : {}),
              },
            ] as [string, Record<string, unknown>])
          : plugin
      ),
      [
        'expo-camera',
        {
          cameraPermission: 'Scan an Arena Fighter room code to join your opponent.',
          microphonePermission: false,
          recordAudioAndroid: false,
        },
      ],
    ],
    // ReactVision SDK credentials are client-visible, like the native Info.plist values.
    extra: { ...config.extra, arenaMultiplayer: { apiKey: apiKey ?? '', projectId } },
  };
};
