# Arena game audio

October 10, 2026. Implemented in the existing `arena-multiplayer` checkout, preserving its local combat, defense, animation, and UI changes. Audio belongs only to the Arena route. Same-space multiplayer still requires internet and a shared cloud-anchor location; remote-location play remains the existing future task.

## Behavior

- Menu music loops through menus/loading/setup. Battle music begins at shared Ready and continues through rounds, knockout/victory presentations, results, and rematches without restarting. Returning to the game menu resumes menu music.
- Host setup offers Host phone, Guest phone, or Both phones for main audio and explains same-space/internet requirements. Host phone is the default. Unpaired phones play their own menu music; paired phones follow the host's source choice.
- Round 1–5, Ready, and Fight use explicit replicated cues. Each clip finishes before the next, with a 150 ms buffer. Fight enables combat immediately and remains visible through its own playback/buffer. Draws repeat the current round number without an invented draw recording.
- Results appear only after the existing full animation presentation. Each player hears their own You Win/You Lose on their phone; both personal clips and a minimum two-second display complete before Ready/rematch. The main-audio choice never mutes these personal results.
- Same-space impacts play on the receiving fighter's phone. Solo plays both fighters' impacts. The pure audio policy also covers future remote play with all impacts; no remote mode is exposed. Existing right/left/uppercut selection and hit/blocked volumes remain intact, with three voices per effect/receiver. Visual feedback remains independent.
- Music defaults to 0.45, voices to 1.0, and speech ducks music to 0.15. Music returns over 150 ms. The title speaks once per route visit.

## Lifecycle and protocol

One Expo Audio owner outlives HUD and AR-view remounts. App interruptions, portrait, tracking loss, and network pauses preserve music/voice positions and freeze cue timers. An inactive audio session also makes the player temporarily incapable, so permission/call interruptions cannot silently advance a countdown. Cleanup releases listeners, timers, and all players; Strict Mode effect reattachment reuses the owner.

Protocol **11** adds main-audio ownership, explicit announcement identity/key/duration/elapsed state, battle-music state, audio availability, and guest completion acknowledgements. Completion applies only to the current session, match, round, epoch, and cue. Cue and completion transitions bypass the ordinary 20 Hz transport pacing. Old clients/invites require both phones to update. Native playback failures fall back to manifest timing; missing completion reaches a duration-plus-five-second active-time watchdog.

`expo-audio` and its direct `expo-asset` peer are installed with SDK 57 compatible versions. Their config plugins disable recording permissions and background audio playback. Sources are packaged through static Metro requires. The asset manifest records all original and playback-copy hashes and durations; source WAVs and existing impact WAVs were preserved.

## Validation and native delivery

The full `npm test` command passed lint/Prettier, TypeScript, and AR, Qubit, Medical, and Arena tests. All 331 Arena tests passed, including 17 new audio cases covering routing, overlapping impacts, actual completion/buffer gates, watchdog/error fallback, pause/resume, stale acknowledgements, main-device mixing, title sequencing, cleanup, and asset hashes/formats. Expo Doctor passes 21/21, and the iOS export packages all fifteen sound assets. Music uses fast-start M4A metadata for playback while Metro serves the assets.

The physical-device development build [02d480be-4fe7-468c-8be2-539da629e826](https://expo.dev/accounts/mrdj2u/projects/xr-showcase/builds/02d480be-4fe7-468c-8be2-539da629e826) completed successfully, using the existing development profile and provisioning for DJ and Kelsey's iPhones. Install the resulting client and connect it to this checkout's Metro server for the current JavaScript and playback copies, including explicit silent-mode configuration and fast-start music metadata.

No physical iPhone audio or two-phone acceptance was performed from this Windows workspace. On both provisioned phones, verify all three main-audio choices, incoming-only impacts (including blocked hits and uppercuts), individual result voices, Round/Ready/Fight timing, all round lengths/draws/rematches, uninterrupted battle music, interruptions/portrait/AR recreation, silent mode, speaker/headphone routing, and the final audible mix. Multiplayer acceptance requires a working relay. These checks do not establish remote play or Android support.

## Host placement and menu playback follow-up

After the host taps a surface, Transform is available throughout scanning, anchor upload, invite creation, waiting for an opponent, and guest alignment. Loading or local tracking recovery temporarily disables editing. The widget exposes the existing Position, Size, Rotation, and Height controls; Back returns from Position to Transform and then restores the invite. Transform offsets remain editable during upload because they are independent of the captured anchor point. New surface placement still waits until the pending upload completes. Changes retain the existing Ready invalidation and guest replication.

The game caches all twelve music/voice assets before creating native players, preventing development music streaming from competing with the host's upload. Initialization finishing after exit cannot create players. Players retain the iOS audio session when paused or finished, speech waits for asset loading before seeking, and the main-audio choice remains applied through peer disconnects. Setup music depends on the local phone's activity/orientation; an opponent turning portrait no longer interrupts it. Combat interruptions retain the existing pause behavior.

The follow-up passed the full `npm test` command (338 Arena tests), lint/Prettier, TypeScript, and the iOS export. The seven additional cases cover host-flow editor availability, edits during upload, menu continuity, reconnect/portrait routing, cache loading, interruption recovery, and initialization cleanup. No native dependency or build configuration changed; reload this checkout through the existing development client's Metro connection. Audible confirmation of the reported music dropout and the native transform layout still require phone testing.
