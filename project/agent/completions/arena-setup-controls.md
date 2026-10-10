# Arena setup controls and portrait pause

October 9, 2026. Follow-up on `arena-multiplayer`, draft PR #5. This supersedes the orientation, QR and placement-editing behavior in the initial multiplayer delivery record. Physical acceptance and the historical Phase 2 remain incomplete.

## Behavior

Arena Fighter permits portrait and both landscape directions. Portrait shows one native Landscape required alert and a dark blur cover with Home available. The mounted menu, scanner or AR tree stays intact. The alert must be dismissed and the phone returned to landscape before the cover clears. Combat, cooldowns, countdowns and knockout presentation resume automatically after 0.5 seconds of normal tracking; both phones must recover in multiplayer. Orientation alone never creates an interruption generation or starts the 30-second recovery deadline. Genuine backgrounding, socket loss, tracking loss and session replacement retain the explicit Resume/recovery path. Accepted attacks retain their remaining hit time through an orientation hold; held movement clears.

Valid QR scans and incoming version-two invite links initiate joining automatically, exactly once. A deferred dispatch waits for scanner unmount and landscape before starting the preflight/AR flow. Back cancels a queued invite or active preflight; failures leave the code available for a manual retry. Portrait never cancels a pending join or a hosting/upload/lookup already in progress. The manual field retains its gray Invite code placeholder. Match selection is labeled Number of Rounds.

Arena uses the existing shared ARTransformControls through a small adapter, with Scale, Rotate, Height, Reposition, Done and Viro pinch/rotation gestures. It becomes available after placement/assets load, including before Create room, and remains editable throughout the initial lobby. The host owns shared edits; guests cannot change them. Opening the panel or changing placement invalidates Ready confirmations. Uploading locks editing. The first countdown locks transforms for the series.

Scale uses 0.5–3 times the original arena size; height uses 0–5 feet; yaw is normalized. Defaults are scale 1, height 0, yaw 0. The transform wraps the arena and both fighters, leaving combat units local. Pre-room Reposition retains captured surroundings and lets the host retap the table. After room creation, the retapped world point is converted into the existing location frame and replicated. Restart AR actually restarts the boundary's native session: unshared placement/capture reset, while an existing room retains its anchor and adjusted pose for localization recovery.

Capture shared space explains that the percentage measures captured surroundings for guest alignment, not placement accuracy. Native capture thresholds and the existing Studio-derived minimum remain unchanged. Native capture/upload may continue under the portrait cover; operations are retained and their completions are saved, rather than cancelled or repeated.

## Interfaces and compatibility

Snapshots and protocol packets carry the authoritative arena transform and explicit orientation holds. Transform commands validate native session and placement scope; input generations and sequencing remain intact. Arena protocol and QR version are now 2, and mismatched peers/invites show an update-both-phones error. Both test phones need the new development client because Expo BlurView adds a native dependency. Credentials remain in ignored local/EAS environment configuration and remain client-visible in a shipped app.

## Validation and physical acceptance

Final MDS Doctor CI passes with score 99 and zero blocking errors. Lint/Prettier, TypeScript, all test suites, Expo Doctor (21/21), iOS export and `git diff --check` pass. React Doctor reports zero errors and 12 advisory warnings, principally component complexity and existing safe-area patterns.

The Arena suite has 110 passing tests, including the unchanged packaged hashes, embedded resources, all 23 clips and GLB repairs. New regressions cover 40-second portrait holds during countdown/attacks/ordinary and launched knockouts, both-phone automatic recovery, genuine disconnect expiry during portrait, transform bounds and stale scopes, host authority/Ready invalidation, capture-preserving repositioning, pending hosting/lookup, native restart recovery, QR deduplication and pending portrait invitations. The shared AR, Qubit and Medical suites also pass. Final MDS CI runs lint/Prettier, TypeScript, those suites, Expo Doctor and iOS export; its result is recorded in the PR.

Physical checks remain unverified. Install the new internal iOS development build on both registered phones, then connect them to this worktree's Metro server. Check:

1. Portrait on every setup stage, alert dismissal while still portrait, Home, both landscape directions, and preserved progress after more than 30 seconds. Confirm actual blur over Viro and native animations resuming at the same point.
2. Solo placement, all transform sliders, pinch/rotation, Reposition without camera restart, and Restart AR. Verify table contact at zero height, positive scale and camera-independent fighting motion.
3. QR scans and external Camera invite links automatically join without another Join press; test invalid/older invites, scanner permission, duplicate scans, portrait pending joins, Back and readable failure/retry.
4. Host transforms before Create room and after the guest joins, opposite-side shared placement, Ready invalidation and fixed transforms after the countdown.
5. Both-phone orientation holds during attacks, countdown, normal/uppercut knockout and intermission; genuine background/socket recovery must still require Resume and expire at 30 seconds.

The previously reported live Viro relay failure remains unresolved; these changes do not claim to repair it. Shared placement, successful real QR/typed-code joins, actual guest latency and sustained 30 FPS still need physical two-phone acceptance. See the credential-free relay incident report and initial multiplayer completion record for the existing source/configuration audit.
