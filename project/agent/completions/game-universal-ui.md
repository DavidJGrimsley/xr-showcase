# Home and game universal UI

Implemented October 11, 2026 in the existing `arena-multiplayer` checkout. Prior multiplayer, combat, audio, diagnostics, and ring design work is preserved.

## Scope

- Home and Neo Rock 'Em Sock 'Em Robots menus, instructions, credits, round selection, room lobby, invite entry, scanner controls, guidance, loading states, and setup actions use Expo UI controls with plain React Native layout styles.
- Guess the Qubit uses Expo UI controls, informational copy, progress indicators, native sheets, and AR status actions. The uncertain hardware submission confirmation now uses a native sheet and retains its round/session safeguards.
- Shared position and transform helpers already used Expo UI sliders/buttons. Their remaining utility classes were replaced with equivalent plain styles. The shared native AR boundary accepts an optional status-panel renderer so the games can opt into Expo UI without replacing the medical viewer's existing panel.
- There are no Uniwind classes in Home, either game's feature directory, the new `src/ui` components, or the shared native placement/transform layout consumed by the games.
- Medical feature files, medical navigation controls, its default status panel, and its web fallback remain unchanged. Settings was already StyleSheet-based and remains unchanged.

## Component boundaries

- `GameButton`, `GameText`/`GameCopy`, `GameInviteField`, `GameConfirmSheet`, and game status panels use the SDK 57 universal `@expo/ui` API. Native trees live in a Host; RN views hosted within them use RNHostView.
- Progress uses SwiftUI on iOS and Compose on Android because this installed universal API has no progress export. The web fallback uses React Native's ActivityIndicator.
- The invite input uses Expo's native observable text state. Delayed JavaScript text events do not overwrite newer native keystrokes; external invitations still update the field. Submission reads the native value and blurs before joining.
- The existing keyboard-controller KeyboardAvoidingView owns join-screen keyboard clearance. A small Android Host adapter maps keyboard-inset handling to Compose's SDK 57 prop.
- Native accessibility wrappers expose labels, disabled/selected state, and activation for buttons; web retains one button role. Button sizing accounts for font scale and wrapped labels.
- Custom iOS fonts use native Dynamic Type scaling; fixed-size system fonts receive React Native font scaling. This avoids multiplying custom-font scaling twice. The packaged arena fonts' PostScript names match their registered names. See [Apple's custom font guidance](https://developer.apple.com/documentation/swiftui/applying-custom-fonts-to-text).
- Static web layout uses identical initial viewport dimensions during export and hydration, then adopts the browser's dimensions. This avoids stale widths and oversized button heights in static HTML.
- Home uses a React Native scroll viewport containing individual Expo UI control Hosts. Its actual content width is measured after layout so controls follow rotation even when window dimensions lag. Home explicitly allows both orientations.
- Native `GameText` waits for the width of an inner RN content view before mounting its Host. Both the Host and universal Text then receive that numeric width, so SwiftUI cannot bootstrap a tall paragraph from a zero-width proposal. Measuring inside the styled wrapper excludes padding and borders. Web copy still renders immediately for static export.

## Preserved custom UI and behavior

- Boxing movement, defense, and attack controls retain their existing touch identifiers, simultaneous touches, press/release handling, and combat feedback. Health bars and fitted live HUD text remain RN views/text.
- QR camera capture, selectable invite codes, title SVG lettering, illustrations, scientific circuit labels, AR scenes, replication, audio, and quantum results retain their existing implementations.
- Existing primary/secondary button assignments and title hiding are preserved. Both join flows retain the reduced header and keyboard handling.
- Existing Expo UI mode/audio pickers and transform controls remain in use. No new native dependency or third-party replacement library was added.

## Device-reported layout corrections

- Removed Home's native scroll/RNHostView nesting to keep its viewport and touch layout in the React Native tree; Expo UI buttons remain in use. Device confirmation of landscape tapping is still required.
- Qubit AR status actions are centered in a horizontal row. Retry and Home share a line at ordinary phone widths, with wrapping retained for constrained widths or large text.
- The arena tagline uses intrinsic React Native text sizing so the dark background hugs the caption.
- Arena scan guidance now reserves a definite text width after accounting for padding and the optional spinner. This prevents the narrow, tall empty panel visible in the supplied screenshots. The message panel passes touches through to AR; recovery buttons remain interactive. Plane detection and placement logic are unchanged.
- The user confirmed these four corrections, then reported the same tall-text behavior elsewhere in the menus. The follow-up audit covers title, solo rounds, multiplayer space selection, Host/Join selection, both host and join modes, audio selection, remote lobby, QR permission/errors, help, credits, orientation cover, and startup/loading screens.
- Menu cards now have a bounded width before measuring copy; action and round rows can wrap. Switching page or play space remounts the scroll viewport at the top without clearing round, audio, or typed-invite state. The invite field fits its card and gives its native input a definite width.
- The audio panel fills its bounded card, with a definite-width native picker. Help and credits use an RN scroll viewport with individual Expo UI controls, following the corrected Home boundary. Startup/loading scroll views have a defined viewport. Shared text measurement fixes captions on all these screens while preserving native controls and accessibility copy.
- Icon-only buttons constrain their invisible accessible-name text to zero height as well as zero width. The previous hidden text could create a tall row even inside a fixed-height button. The audio picker also has an RN width wrapper, keeping its placement consistent when the universal web Host renders without a native view.

## Validation

- `npm test`: all **537 tests** pass after the menu audit: 14 AR, 130 Qubit, 23 medical, 358 arena, and 12 UI. Lint, formatting, and TypeScript pass. Added checks cover measured Home widths through rotation, status-action callbacks, scan-guidance width with/without a spinner, touch pass-through, text measurement through zero-width/rotation layouts, and every menu branch at phone/tablet widths and larger text sizes.
- Expo Doctor at the initial refactor: **21/21** checks pass; dependencies are unchanged by the layout corrections.
- Final iOS and Android exports succeed, including the layout corrections.
- A temporary web-enabled export succeeds. Initial browser checks cover Home at 320, 391, and 1440 pixels. The layout-correction check covers 844×390 landscape and rotation through 390×844 portrait to 667×375 landscape: all three game buttons remain unobstructed, follow the measured content width, and navigate to their routes. Returning from the phone-required screens works. No application startup or hydration errors remain; the local static server's initial favicon 404 is unrelated to application execution.
- The menu audit additionally uses a temporary browser preview of the actual arena menu tree, with a local web-only Viro adapter that disables AR and relay connection actions. Checks cover both play spaces, host rounds/audio, both invite-entry screens, QR permission, returning from the scanner without losing typed text, solo rounds, How to Play, and all seven credit actions. At 844×390, the Host/Join card is 96px tall, invite entry 162px, remote host 154px, solo rounds 122px, and shared host including audio 302px. At 568×320, the host action can be scrolled fully into view and invite entry remains usable. These browser measurements validate the menu structure; native text measurement is covered by the component tests and still requires the phone retest.
- The preview's entry-point, platform, and Metro resolver changes were temporary and restored byte-for-byte. The Viro adapter and preview exports live only under ignored `.expo` paths. A final export with the original native configuration validates the final button/picker adjustments.
- The web platform was enabled only during local export validation; `app.json` was restored byte-for-byte. Package lock, dependencies, Metro/CSS configuration, and medical feature files have no changes from this migration.
- The user confirmed Home tapping after rotation, Qubit status-button alignment, arena tagline sizing, and scan guidance corrections. Physical device verification remains for the follow-up menu sizing, join keyboard visibility, native font/layout sizing, VoiceOver/TalkBack activation, large text, sheets, transform sliders, and simultaneous boxing gestures. Exports and mocked component tests do not replace this check.

## Uniwind removal after the parallel merge

Keep the existing Uniwind and Tailwind dependencies/configuration until the medical branch lands. Remaining class usage is in medical UI, the medical-only header action, and its shared default/web status panels. Once those are migrated, remove the Uniwind Metro wrapper, CSS imports, generated typings, and dependencies together. Home and both games no longer depend on utility classes.

Validation logs and exports are under the ignored `.expo/ui-*` paths. No environment files or credentials were changed.
