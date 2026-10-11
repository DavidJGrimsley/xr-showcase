# Qubit connection diagnostics and recovery messages

Completed October 11, 2026 in the existing `arena-multiplayer` checkout. Existing arena changes were preserved.

## Findings

- The effective Expo Quantum API key in this checkout matches the medical checkout's key. No environment files were changed by this work.
- Live checks using the updated app client passed: public health in 174 ms and authenticated hardware discovery in 1,035 ms.
- Desktop checks do not establish which JavaScript/environment bundle is running on an iPhone or whether the phone's network requests succeed.
- Connection checks previously displayed `Reconnecting…` for every failure, including rejected credentials and unavailable hardware. Round polling also used the same generic message.

## Changes

- Added specific connection and round messages for access denied, rate limiting, unreachable service, timeouts, service outages, invalid responses, rejected requests, missing hardware, missing build configuration, and local job-cleanup failures.
- Failed connections show an inline warning and a Retry connection action, including before AR placement. Placement guidance remains visible.
- Hardware-only failures preserve simulator availability. Denied cancellation of a previous job is distinguished from denial of the current connection; hardware stays paused until cancellation is resolved.
- Rate limiting shows remaining wait time. Manual and automatic connection checks respect both connection and round Retry-After deadlines, including after Reset.
- Retry connection only checks connectivity; it cannot overlap an active check or repeat a measurement or hardware submission. Existing late-job cancellation and uncertain-submission protections remain intact.
- Added development diagnostics under `[Qubit config]`, `[Qubit connection]`, and `[Qubit API]`. Records include a diagnostic revision, configuration presence, service host, selected backend, request/attempt sequence, stage/operation, elapsed time, sanitized error code, HTTP error status, and retry delay.
- Diagnostics exclude API keys, profile contents, request/response bodies, raw exceptions, job identifiers, and placement. Production builds retain error handling and UI messages without these console diagnostics.

## Verification

- `npm test`: all 523 tests pass (14 AR, 130 Qubit, 23 medical, 356 arena), including lint and TypeScript checks.
- Added 22 Qubit tests covering diagnostics sanitization, timeouts and late submissions, retry concurrency, deadline enforcement, simulator fallback, actionable presentation, and cleanup failures.
- `npm run build:ios`: export succeeds.
- Physical iPhone behavior remains to be checked.

## Collecting phone logs

Restart Metro from this checkout with `npm start -- --clear`, then reload the phone app and open Guess the Qubit. The `[Qubit config]` entry should show `diagnosticsVersion: 1`; absent entries indicate that these diagnostics have not been loaded. Inspect `[Qubit connection]` stage failures and the corresponding `[Qubit API]` failure's `operation`, `errorCode`, and `status`. A zero HTTP status is also used for local validation, timeout, or network failures; use the error code to distinguish them. Share these prefixed entries for follow-up diagnosis, without sharing `.env` contents.
