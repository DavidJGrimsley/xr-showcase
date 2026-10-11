import { useCallback, useState, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetch } from 'expo/fetch';
import { QuantumApiClient } from '@/services/quantum-api';
import { getQubitBuildConfiguration } from './qubit-configuration';
import { QubitRoundController } from './qubit-round-controller';
import { QubitConnectionController } from './qubit-connection-controller';
import { QubitJobCleanup } from './qubit-job-cleanup';

const cleanup = new QubitJobCleanup(AsyncStorage);

export function useQubitConfiguration() {
  const [client] = useState(() => {
    const credentials = getQubitBuildConfiguration({
      apiKey: process.env.EXPO_PUBLIC_QUANTUM_API_KEY,
      baseUrl: process.env.EXPO_PUBLIC_QUANTUM_API_BASE_URL,
      backend: process.env.EXPO_PUBLIC_QUANTUM_BACKEND,
      profile: process.env.EXPO_PUBLIC_QUANTUM_IBM_PROFILE,
    });
    if (__DEV__)
      console.info('[Qubit config]', {
        diagnosticsVersion: 1,
        configured: !!credentials,
        apiKeyConfigured: !!process.env.EXPO_PUBLIC_QUANTUM_API_KEY?.trim(),
        serviceHost: credentials ? new URL(credentials.baseUrl!).host : null,
        backend: credentials?.backend ?? null,
        profileConfigured: !!credentials?.profile,
      });
    return credentials
      ? new QuantumApiClient(
          fetch,
          credentials,
          undefined,
          __DEV__ ? (event) => console.info('[Qubit API]', event) : undefined
        )
      : null;
  });
  const [controller] = useState(() => new QubitRoundController(() => client, undefined, cleanup));
  const [connection] = useState(
    () =>
      new QubitConnectionController(
        client,
        controller,
        cleanup,
        undefined,
        __DEV__ ? (event) => console.info('[Qubit connection]', event) : undefined
      )
  );
  const state = useSyncExternalStore(connection.subscribe, connection.getSnapshot);
  useFocusEffect(
    useCallback(() => {
      const stop = () => {
        connection.stop();
        const session = controller.getSessionId();
        if (session !== null) controller.detach(session);
      };
      if (AppState.currentState === 'active') connection.start();
      const subscription = AppState.addEventListener('change', (status) => {
        if (status === 'active') connection.start();
        else stop();
      });
      return () => {
        subscription.remove();
        stop();
      };
    }, [connection, controller])
  );
  return { controller, retryConnection: connection.retry, ...state };
}
