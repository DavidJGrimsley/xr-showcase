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
    return credentials ? new QuantumApiClient(fetch, credentials) : null;
  });
  const [controller] = useState(() => new QubitRoundController(() => client, undefined, cleanup));
  const [connection] = useState(() => new QubitConnectionController(client, controller, cleanup));
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
  return { controller, ...state };
}
