# Long-distance arena multiplayer

Implemented on October 11, 2026 in the `arena-multiplayer` checkout. Before implementation, commit `15a9ff8` preserved the existing combat, UI, audio, assets, and other uncommitted work. Feature changes remain available for review in the working tree.

## Delivered behavior

- **2 Players → Same table / Long distance → Host / Join.** A remote host creates a connected lobby before entering AR, with Share invite, QR, a grouped twelve-character code, and Place arena. A guest must observe fresh, owned host state before claiming the guest seat. The invitation appears after ownership and the initial publication have been echoed by the relay. Invalid codes, inactive hosts, capacity, incompatible versions/modes, and service failures have separate messages.
- Native Expo Core UUID entropy generates remote codes, which map directly to `arena-remote-v1:` room IDs. There is no invite registry, cloud anchor, extra backend, or new native dependency. The existing ReactVision relay at `colocation.reactvision.xyz` carries match state and input. Same-table anchor/room services remain at `platform.reactvision.xyz`. Models, music, voices, and effects are bundled in the app; the host phone runs combat.
- Each remote phone uses Viro provider `none` and its own local plane placement, position offsets, height, rotation, and scale. Physical placement/display transforms are absent from remote packets. Both phones render the same arena-relative fighter poses below their own transform. Local edits clear only local Ready. Remote Swap Sides becomes Rotate view 180°. Transforms stay fixed during rounds.
- A room session owns the remote socket independently of the AR view. Recreating AR resets only that phone's placement and renderer readiness, preserving the fight, score, and socket. Both players must Resume. The existing one-second heartbeat interruption and thirty-second recovery deadline remain in effect.
- Protocol 12 includes explicit play space, movement sequence acknowledgements, simulation time, and echoed input timing. Remote links include `space=remote`; omitted space selects same-table play. Unknown spaces and older versions are rejected. Pending scanned invitations retain space and wait for scanner teardown before dispatch.
- Guest movement/facing prediction shares the authoritative orbit, boundary, and separation geometry. History is limited to 250 ms. Ordinary corrections blend over 100 ms; combat locks, impacts on either fighter, generation changes, and corrections over 0.02 arena units snap. Damage, attacks, defense transitions, impacts, and results remain authoritative. Pauses and reconnects clear prediction.
- Remote music/announcements run on both phones, and the prepared remote impact policy plays every impact on each phone. Existing cue identities, completion acknowledgements, personal result voices, deduplication, and interruption behavior are retained. Development diagnostics log connection state, echoed round-trip timing, prediction history, and correction magnitude without credentials or placement coordinates.

## Automated validation

| Check                          | Result                                                                                                                                           |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm test`                     | Lint/Prettier, TypeScript, and all 501 tests passed: AR 14, Qubit 108, Medical 23, Arena 356                                                     |
| `npx expo-doctor`              | 21/21 checks passed                                                                                                                              |
| `npm run build:ios`            | iOS JavaScript/asset export passed                                                                                                               |
| `git diff --check`             | Passed                                                                                                                                           |
| Authenticated relay diagnostic | Two SDK clients claimed seats, exchanged host packets and guest inputs, reclaimed guest ownership after reconnect, and cleared the isolated room |

Remote regressions cover independent transforms and Ready states, mode/link parsing, stale hosts, occupied seats, cancellation before publication, room preservation across AR placement, obsolete AR cleanup, recreation during combat, authoritative damage, coalesced impacts, correction blending, and both-phone audio policy. Movement runs at 50, 150, 300, and 500 ms simulated round-trip delays with jitter, coalesced snapshots, a delivery stall, and duplicate input; positions stay bounded and retained prediction stays within 250 ms. Existing shared-table regressions pass.

Repeat the live check with `node --env-file=.env --experimental-strip-types scripts/arena-relay-check.cjs`. It uses the installed Viro replication client and the configured credentials without printing credentials, room codes, or raw SDK errors. No VPS is needed based on this successful exchange.

## Device acceptance still required

Both iPhones must load the updated JavaScript (protocol 12) and create a fresh invite. A native rebuild is not expected for this change. No physical iPhones were accessible during implementation, so these checks remain pending:

1. Use separate networks. Select Long distance, host/share/join, then place each arena on a different table with distinct position, scale, height, and rotation. Confirm synchronized fighter coordinates and independent views.
2. Confirm movement response, attacks, blocking, authoritative health, and every impact sound. Listen for music, announcements, personal win/loss voices, and absence of duplicated cues.
3. Finish rounds, a series, and a rematch. Edit each view after the series and confirm only that player's Ready clears.
4. Exercise portrait holds, backgrounding, network interruption/retry, and AR recreation. Confirm preserved state, local replacement only, both-player Resume, and abandonment after the recovery deadline.
5. Recheck Same table hosting, capture/localization, shared transforms, audio selection, rounds, and recovery on the updated JavaScript.

Voice chat, matchmaking, host migration, and process-restart recovery remain outside this change.
