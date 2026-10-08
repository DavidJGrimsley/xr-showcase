# Quantum hackathon demo setup

Guess the Qubit uses `@mr.dj2u/quantum-api@0.1.2`. Players open the game, place the sphere, and guess; there is no API-key entry or configuration screen. The game checks connectivity automatically and offers Reconnect on failure.

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

Enter the game and confirm it connects without setup. Test live simulator guesses, placement/readability, Reduce Motion, Reset, Home, background/resume, and camera handoff. Hardware remains an intentional user-selected one-shot action; connectivity checking never submits a job. Opt in to a hardware guess and check queue/result/cancellation behavior when ready. Automated tests use mock transport and do not prove native AR or real IBM execution.

If the build omits the key or has an invalid service URL, the game reports that the demo service is not configured and disables guesses. It never asks the player for credentials. Correct the build environment and rebuild.
