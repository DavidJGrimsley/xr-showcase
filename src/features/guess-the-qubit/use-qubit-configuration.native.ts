import { useCallback, useEffect, useRef, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import { fetch } from 'expo/fetch';
import { QuantumApiClient, QuantumError } from '@/services/quantum-api';
import { QubitConfiguration } from './qubit-configuration';
import { QubitRoundController } from './qubit-round-controller';

export function useQubitConfiguration() {
  const [configuration] = useState(
    () =>
      new QubitConfiguration({
        getItemAsync: (key) => SecureStore.getItemAsync(key),
        setItemAsync: (key, value) =>
          SecureStore.setItemAsync(key, value, {
            keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
          }),
        deleteItemAsync: (key) => SecureStore.deleteItemAsync(key),
      })
  );
  const [controller] = useState(
    () =>
      new QubitRoundController(() => {
        const credentials = configuration.forTransport();
        return credentials ? new QuantumApiClient(fetch, credentials) : null;
      })
  );
  const [summary, setSummary] = useState(() => configuration.summary());
  const [busy, setBusy] = useState(true);
  const [message, setMessage] = useState('Loading private configuration…');
  const [retryAt, setRetryAt] = useState(0);
  const live = useRef(false);
  const pending = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const operationBusy = useRef(true);
  const cancelCheck = useCallback(() => {
    generation.current++;
    if (!pending.current) return;
    pending.current.abort();
    pending.current = null;
    operationBusy.current = false;
    if (live.current) {
      setBusy(false);
      setMessage('Connection check stopped. Check again when ready.');
    }
  }, []);
  useEffect(() => {
    live.current = true;
    void configuration
      .load()
      .then(() => {
        if (!live.current) return;
        setSummary(configuration.summary());
        setMessage(
          configuration.summary().configured
            ? 'Key saved. Check connection before guessing.'
            : 'Configure an existing development key to play.'
        );
      })
      .catch(() => {
        if (live.current)
          setMessage(
            'Private configuration could not load. Open Configure to replace or remove it.'
          );
      })
      .finally(() => {
        operationBusy.current = false;
        if (live.current) setBusy(false);
      });
    return () => {
      live.current = false;
      cancelCheck();
    };
  }, [configuration, cancelCheck]);
  const save = (apiKey: string, backend: string, profile: string) => {
    if (operationBusy.current) return Promise.resolve(false);
    operationBusy.current = true;
    setBusy(true);
    return configuration
      .save(apiKey, backend, profile)
      .then(() => {
        controller.setAvailability(false, false);
        if (live.current) {
          setSummary(configuration.summary());
          setMessage('Saved securely. Check connection before guessing.');
        }
        return true;
      })
      .catch((error: unknown) => {
        if (live.current)
          setMessage(error instanceof Error ? error.message : 'Configuration could not be saved.');
        return false;
      })
      .finally(() => {
        operationBusy.current = false;
        if (live.current) setBusy(false);
      });
  };
  const remove = () => {
    if (operationBusy.current) return Promise.resolve();
    operationBusy.current = true;
    setBusy(true);
    return configuration
      .remove()
      .then(() => {
        controller.setAvailability(false, false);
        if (live.current) {
          setSummary(configuration.summary());
          setMessage('Private configuration removed.');
        }
      })
      .catch(() => {
        if (live.current) setMessage('Private configuration could not be removed. Try again.');
      })
      .finally(() => {
        operationBusy.current = false;
        if (live.current) setBusy(false);
      });
  };
  const check = () => {
    if (operationBusy.current || Date.now() < retryAt || controller.getSnapshot().phase !== 'idle')
      return;
    const credentials = configuration.forTransport();
    if (!credentials) return;
    const token = ++generation.current;
    const abort = new AbortController();
    pending.current = abort;
    const current = () => live.current && generation.current === token;
    operationBusy.current = true;
    setBusy(true);
    setMessage('Checking the service and configured hardware backend…');
    controller.setAvailability(false, false);
    let simulator = false;
    const client = new QuantumApiClient(fetch, credentials);
    return client
      .health(abort.signal)
      .then((mode) => {
        if (!current()) return;
        simulator = true;
        return client.checkHardware(abort.signal).then(() => {
          if (!current()) return;
          controller.setAvailability(true, true);
          setMessage(
            `${mode === 'qiskit' ? 'Qiskit simulator' : 'Classical fallback simulator'} ready. Hardware backend found; queue availability is checked on submission.`
          );
        });
      })
      .catch((error: unknown) => {
        if (!current()) return;
        controller.setAvailability(simulator, false);
        setMessage(
          `${simulator ? 'Simulator available. Hardware: ' : ''}${error instanceof QuantumError ? error.message : 'Connection check failed.'}`
        );
        if (error instanceof QuantumError) {
          setRetryAt(error.retryAt);
          controller.deferUntil(error.retryAt);
        }
      })
      .finally(() => {
        if (current()) {
          pending.current = null;
          operationBusy.current = false;
          setBusy(false);
        }
      });
  };
  return { controller, summary, busy, message, retryAt, save, remove, check, cancelCheck };
}
