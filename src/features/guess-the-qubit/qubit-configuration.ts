import type { QuantumCredentials } from '../../services/quantum-api';

export const QUBIT_CONFIG_KEY = 'xr-showcase.quantum.configuration.v1';
export const DEFAULT_BACKEND = 'ibm_kingston';
export const DEFAULT_PROFILE = 'Unreal Engine Demos';
export interface PrivateStorage {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
}
export class QubitConfiguration {
  private storage: PrivateStorage;
  private credentials: QuantumCredentials | null = null;
  private busy = false;
  constructor(storage: PrivateStorage) {
    this.storage = storage;
  }
  summary() {
    return {
      configured: this.credentials !== null,
      backend: this.credentials?.backend ?? DEFAULT_BACKEND,
      profile: this.credentials?.profile ?? DEFAULT_PROFILE,
    };
  }
  // Only hand this private copy to the transport; never put it into UI state or diagnostics.
  forTransport(): QuantumCredentials | null {
    return this.credentials ? { ...this.credentials } : null;
  }
  async load() {
    try {
      const stored = await this.storage.getItemAsync(QUBIT_CONFIG_KEY);
      if (stored === null) {
        this.credentials = null;
        return;
      }
      const value: unknown = JSON.parse(stored);
      if (!value || typeof value !== 'object') throw new Error();
      const data = value as Record<string, unknown>;
      if (
        typeof data.apiKey !== 'string' ||
        !data.apiKey.trim() ||
        typeof data.backend !== 'string' ||
        !data.backend.trim() ||
        typeof data.profile !== 'string' ||
        !data.profile.trim()
      )
        throw new Error();
      this.credentials = { apiKey: data.apiKey, backend: data.backend, profile: data.profile };
    } catch {
      this.credentials = null;
      throw new Error(
        'Private configuration could not be loaded. Enter it again or remove the saved configuration.'
      );
    }
  }
  async save(apiKey: string, backend: string, profile: string) {
    if (this.busy) throw new Error('Configuration is already being updated.');
    const next = {
      apiKey: apiKey.trim() || this.credentials?.apiKey || '',
      backend: backend.trim(),
      profile: profile.trim(),
    };
    if (!next.apiKey || !next.backend || !next.profile)
      throw new Error('Enter an existing API key, backend, and profile.');
    this.busy = true;
    try {
      await this.storage.setItemAsync(QUBIT_CONFIG_KEY, JSON.stringify(next));
      this.credentials = next;
    } catch {
      throw new Error(
        'Configuration could not be saved securely. The previous configuration is unchanged.'
      );
    } finally {
      this.busy = false;
    }
  }
  async remove() {
    if (this.busy) throw new Error('Configuration is already being updated.');
    this.busy = true;
    try {
      await this.storage.deleteItemAsync(QUBIT_CONFIG_KEY);
      this.credentials = null;
    } catch {
      throw new Error('Saved configuration could not be removed. Try again.');
    } finally {
      this.busy = false;
    }
  }
}
