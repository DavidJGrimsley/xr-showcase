import Constants from 'expo-constants';

export function arenaConfiguration(): { apiKey: string; projectId: string } | null {
  const config = Constants.expoConfig?.extra?.arenaMultiplayer;
  return config &&
    typeof config.apiKey === 'string' &&
    config.apiKey &&
    typeof config.projectId === 'string'
    ? { apiKey: config.apiKey, projectId: config.projectId }
    : null;
}
