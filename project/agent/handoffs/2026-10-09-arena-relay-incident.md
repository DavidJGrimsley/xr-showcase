# ReactVision multiplayer relay unavailable

Observed October 9, 2026, with network checks at approximately 00:31 UTC October 10. No credentials are included in this report.

The user successfully placed an arena, captured sufficient scan quality, hosted the cloud anchor and received a room QR/invite. Native scan finalization plus hosting took about a minute or more. Both iPhones then reported `replication socket gave up reconnecting`; the host was already showing it before the guest scanned the QR.

The installed SDK is `@reactvision/react-viro` 3.0.3. `ViroReplicationClient` connects to `wss://colocation.reactvision.xyz/functions/v1/replication/{roomId}`, sending the documented `x-api-key` and `x-project-id` handshake headers. This matches [Viro co-location documentation](https://viro-community.readme.io/docs/co-location). Its JavaScript WebSocket adapter discards most underlying close/error detail and retries five times before producing the reported sentence.

Independent network observations from the development machine:

- A Node `ws` connection to the documented replication endpoint fails TLS before the HTTP upgrade or any authenticated room exchange: `SSL alert number 40`, TLS handshake failure, then WebSocket close code 1006.
- Windows `curl -I https://colocation.reactvision.xyz/` also fails TLS with `SEC_E_ILLEGAL_MESSAGE`.
- DNS resolves `colocation.reactvision.xyz` as a CNAME to `rvca-1fb6.orvex.cloud`.
- An unauthenticated HTTPS request to that CNAME target completes TLS. Its `/health` response is HTTP 200 with service `Orvex API`, version `1.0.0`. The documented replication path returns HTTP 404 with an Express-style `Route GET /functions/v1/replication/diagnostic not found` response.
- No app credentials were sent to the alternate hostname. It is not configured as a fallback.

These observations point to relay TLS/custom-domain routing or deployment rather than fighter simulation, QR content or shared-anchor placement. A successful cloud-anchor upload does not establish that the separate live relay is reachable. The machine checks do not capture the iPhones' native TLS diagnostics, but independently reproduce a failure at the exact SDK hostname before authentication.

ReactVision needs to verify the deployed replication relay, repair the custom hostname's TLS/routing, or provide an official working secure relay base URL. There is no authorization or access in this workspace to modify that infrastructure. No insecure WebSocket or disabled certificate verification workaround has been added.

App corrections delivered alongside this report:

- Authenticate a temporary Viro replication connection before opening multiplayer AR/capture. A failed check returns to the menu with a clear server-unreachable message and leaves solo available.
- Translate connection/access/invite failures into actionable messages. A failed socket is no longer mislabeled as an expired room after thirty seconds; stale SDK errors do not persist during a new retry.
- Show a QR/code only while the host's live connection is established. Retain the localized arena on connection-only Retry.
- Separate native processing/upload from invite creation, show real elapsed seconds and cancellation, and allow up to two minutes for native hosting. Diagnostics contain only state, step, result and elapsed time.
- Accept an optional `RV_REPLICATION_ENDPOINT` in local/EAS environment configuration for an official replacement relay. Only secure HTTPS/WSS base URLs are accepted; no credentials, paths or query strings. This setting affects replication only and does not replace the platform room API endpoint.

After infrastructure recovery, reopen the Metro project and test the actual preflight welcome, host/QR/typed joins, opposite-side localization, Ready, interruption recovery and rematches on both phones. A development build is unnecessary for these JavaScript changes; use a rebuild only if the native SDK or plugin configuration changes.
