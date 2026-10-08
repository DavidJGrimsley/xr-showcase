import { useCallback, useEffect, useRef, useState } from 'react';
import { fetch } from 'expo/fetch';
import { QuantumApiClient, QuantumError } from '@/services/quantum-api';
import { getQubitBuildConfiguration } from './qubit-configuration';
import { QubitRoundController } from './qubit-round-controller';

export function useQubitConfiguration() {
  const [client] = useState(() => {
    const credentials = getQubitBuildConfiguration({
      // Expo inlines these exact property accesses into the client bundle.
      apiKey: process.env.EXPO_PUBLIC_QUANTUM_API_KEY,
      baseUrl: process.env.EXPO_PUBLIC_QUANTUM_API_BASE_URL,
      backend: process.env.EXPO_PUBLIC_QUANTUM_BACKEND,
      profile: process.env.EXPO_PUBLIC_QUANTUM_IBM_PROFILE,
    });
    return credentials ? new QuantumApiClient(fetch, credentials) : null;
  });
  const [controller] = useState(() => new QubitRoundController(() => client));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(
    client
      ? 'Connecting to the quantum service…'
      : 'The demo service is not configured in this build.'
  );
  const [retryAt, setRetryAt] = useState(0);
  const live = useRef(false);
  const pending = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const retryAfter = useRef(0);
  const cancelCheck = useCallback(() => {
    generation.current++;
    if (!pending.current) return;
    pending.current.abort();
    pending.current = null;
    if (live.current) {
      setBusy(false);
      setMessage('Connection check stopped. Tap Reconnect to try again.');
    }
  }, []);
  const check = useCallback(() => {
    if (
      !client ||
      pending.current ||
      Date.now() < retryAfter.current ||
      controller.getSnapshot().phase !== 'idle'
    )
      return;
    const token = ++generation.current;
    const abort = new AbortController();
    pending.current = abort;
    const current = () => live.current && generation.current === token;
    setBusy(true);
    setMessage('Connecting to the quantum service…');
    controller.setAvailability(false, false);
    let simulator = false;
    return client
      .health(abort.signal)
      .then((mode) => {
        if (!current()) return;
        simulator = true;
        controller.setAvailability(true, false);
        setMessage(`${mode === 'qiskit' ? 'Qiskit simulator' : 'Simulator'} ready.`);
        return client.checkHardware(abort.signal).then(() => {
          if (!current()) return;
          controller.setAvailability(true, true);
          setMessage('Simulator and hardware ready. Choose your guess.');
        });
      })
      .catch((error: unknown) => {
        if (!current()) return;
        // A rejected demo key must not enable either mode. Backend failure can leave simulator available.
        const denied = error instanceof QuantumError && error.code === 'credentials';
        controller.setAvailability(simulator && !denied, false);
        setMessage(
          `${simulator && !denied ? 'Simulator ready. Hardware: ' : ''}${error instanceof QuantumError ? error.message : 'Connection failed. Tap Reconnect to try again.'}`
        );
        if (error instanceof QuantumError) {
          retryAfter.current = error.retryAt;
          setRetryAt(error.retryAt);
          controller.deferUntil(error.retryAt);
        }
      })
      .finally(() => {
        if (current()) {
          pending.current = null;
          setBusy(false);
        }
      });
  }, [client, controller]);
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
      cancelCheck();
    };
  }, [cancelCheck]);
  return { controller, configured: client !== null, busy, message, retryAt, check, cancelCheck };
}
