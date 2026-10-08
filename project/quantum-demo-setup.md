# Quantum hackathon demo setup

Guess the Qubit uses `@mr.dj2u/quantum-api@0.1.2`. Players open the game, place the sphere, and guess; there is no API-key entry or configuration screen. Connection checks and interrupted job polling reconnect automatically without resubmitting hardware work.

## Configure once before building

Copy the root `.env.example` to `.env` for local development. Set `EXPO_PUBLIC_QUANTUM_API_KEY` to the existing demo runtime key. The example intentionally contains no actual key. `.env` and its variants are Git-ignored.

For EAS, set the same variables in the project's **development** environment. Both checked-in development build profiles select that environment. Use Plain text or Sensitive visibility so Expo can inline the public values. Then build the physical-device profile with `eas build --platform ios --profile development`.

| Variable | Default / purpose |
| --- | --- |
| `EXPO_PUBLIC_QUANTUM_API_KEY` | Required existing demo key, supplied once by the owner |
| `EXPO_PUBLIC_QUANTUM_API_BASE_URL` | `https://davidjgrimsley.com/public-facing/api/quantum/v1` |
| `EXPO_PUBLIC_QUANTUM_BACKEND` | `ibm_kingston` |
| `EXPO_PUBLIC_QUANTUM_IBM_PROFILE` | `Unreal Engine Demos` (existing service profile) |

This is the owner-authorized hackathon client-key approach: the key is included in the app's JavaScript bundle. Do not commit its value. No IBM token, login token, or credential administration is needed.

Expo reads explicit `process.env.EXPO_PUBLIC_*` property accesses during bundling. After changing local values, restart Metro with `npm start -- --clear` and fully reload the app so cached transforms do not retain old values. Rebuild/rebundle to change values shipped in an existing build. For a local export after env changes, use `npm run build:ios -- --clear`. See [Expo environment variables](https://docs.expo.dev/guides/environment-variables/) and [EAS environment variables](https://docs.expo.dev/eas/environment-variables/).

## Verify on the development build

Enter the game and confirm it connects without setup. Before placement, only the placement caption appears in the HUD. After placement, Simulator has no caption; Hardware Jobs has a short waiting/cancellation caption. Centered controls are `0`, `1`, `Reset Qubit`, and `Restart AR`, with `−` / `+` beside the mode selector. Both guesses become outlined, gray, and faded whenever guessing is unavailable, including the previously selected guess.

Pinch the placed sphere with two fingers, or tap `−` / `+`, to change its size. Both methods share one size setting, from half to three times the default diameter (12.5–75 cm). Sizing does not restart a round or submit a job. Reset Qubit and restarting AR retain the selected size. All nine labels use native vector text geometry. Test label sharpness at each size and distance, pinch handling, centered controls, Dynamic Type, VoiceOver, Reduce Motion, live simulator guesses, and camera handoff.

Hardware remains an intentional user-selected one-shot action; connectivity checking never submits a job. Opt in to a hardware guess and check queue/result/cancellation behavior when ready. Reset Qubit, Restart AR, surface loss, navigating away, and backgrounding stop the round and request cancellation of known unfinished jobs. Failed or incomplete cancellations are retried automatically; only job IDs are saved locally so reopening can cancel outstanding jobs before enabling hardware again.

A submission interrupted before the service returns a job ID shows one yellow message. A later acknowledgement is used only for cancellation. Reset Qubit requires confirmation before permitting another hardware submission. Hardware submission waits up to 60 seconds; polling is sequential every 15 seconds and respects Retry-After.

Cancellation is a request to the service, not proof that the provider stopped a job. An immediate force quit, loss of connectivity, or termination before a job ID arrives can prevent client cleanup. Guaranteed unattended-job expiry requires a server-side lease, which the current API does not expose. The caption therefore says leaving **requests cancellation**. Automated tests and JavaScript export do not prove native behavior or actual IBM cancellation.

If the build omits the key or has an invalid service URL, the placed HUD reports `Demo service unavailable.` and disables guesses. It never asks the player for credentials. Correct the build environment and rebuild.
