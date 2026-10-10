import Constants from 'expo-constants';

export interface ArenaConfiguration {
  apiKey: string;
  projectId: string;
  replicationEndpoint?: string;
}
export function arenaConfiguration(): ArenaConfiguration | null {
  const config = Constants.expoConfig?.extra?.arenaMultiplayer;
  return config &&
    typeof config.apiKey === 'string' &&
    config.apiKey &&
    typeof config.projectId === 'string'
    ? {
        apiKey: config.apiKey,
        projectId: config.projectId,
        replicationEndpoint: config.replicationEndpoint,
      }
    : null;
}
