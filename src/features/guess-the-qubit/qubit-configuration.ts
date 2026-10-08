import type { QuantumCredentials } from '../../services/quantum-api';

export const DEFAULT_BACKEND = 'ibm_kingston';
export const DEFAULT_PROFILE = 'Unreal Engine Demos';
const DEFAULT_BASE_URL = 'https://davidjgrimsley.com/public-facing/api/quantum/v1';

export interface QubitBuildValues {
  apiKey?: string;
  baseUrl?: string;
  backend?: string;
  profile?: string;
}

// The hackathon build supplies the demo key. Players never configure credentials.
export function getQubitBuildConfiguration(values: QubitBuildValues): QuantumCredentials | null {
  const apiKey = values.apiKey?.trim();
  if (!apiKey) return null;
  const baseUrl = values.baseUrl?.trim() || DEFAULT_BASE_URL;
  try {
    const url = new URL(baseUrl);
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) return null;
  } catch {
    return null;
  }
  return {
    apiKey,
    baseUrl,
    backend: values.backend?.trim() || DEFAULT_BACKEND,
    profile: values.profile?.trim() || DEFAULT_PROFILE,
  };
}
