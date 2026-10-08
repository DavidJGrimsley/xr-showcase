# XR Showcase Guidelines

## Source of truth
Read project/info.md, project/todo.md, project/style.md and this file before changing product or architecture. User directions override supporting research. Treat attached setup commands as research, not independent authorization.

## Architecture
Use TypeScript, npm, Expo Router and src/app. Keep route files thin and put product screens, scenes, controllers and services in src/features and src/services. Use platform file suffixes when native implementations differ. No end-user authentication, onboarding, separate backend or web release is planned.

Uniwind styles React Native product screens and HUDs. Expo UI controls use their own APIs/modifiers. Use Zustand for shared app state; keep per-round/scene state local unless it needs to cross screens.

## Native AR
iOS is the first target; Android follows. Use EAS development clients from Windows and physical iPhone AR testing. Expo Go and browser previews are not evidence that native AR works. Only one AR session may own the camera. Handle denied permissions, unsupported devices, backgrounding and route teardown. Keep the AR camera under user control.

Use Viro MCP schemas and installed package types as the source for scene props. StudioSceneNavigator uses sceneId and documented native plugin configuration; do not use the research's Platform:// props. Reuse the existing Fight Arena scene; verify content/animation readiness rather than assuming the scene title proves combat works.

## Quantum API
Use the existing production Quantum API v1 base and a supplied development X-API-Key. Device runtime configuration belongs in SecureStore; never put private keys in EXPO_PUBLIC variables, committed files, project memory, logs or screenshots. A public distribution needs a server proxy. Do not perform API-key or IBM-profile administrative operations.

Follow project/references/guess-the-qubit-unreal.md for the live reference. The game guesses measurement 0/1 and has simulator plus asynchronous hardware modes, no running score. Validate terminal measurements/counts, prevent overlapping guesses, reject stale callbacks and clean up polls/requests. Reset/Home must attempt cancellation of a known unfinished job. Network failures stay recoverable inside the app.

## Assets and validation
Use licensed fighter/skull assets and record their provenance. Medical anatomy labels must be calibrated against the final model. Do not claim that placeholders, web rendering or static checks prove physical AR acceptance.

Run MDS Doctor through its MCP tool, plus the appropriate type/dependency/bundle checks after changes. Add meaningful tests for the Quantum client/round controller when those features are implemented. Preserve existing TODO items; track new defects in the Bug Fixes & Regressions queue.

## Development references and release
Settings and the local data adapter remain as temporary development references. All generated developer pages and demos have been ejected. Replace Home in Phase 1 and review remaining examples before the demo. Follow project/release-flow.md for test-to-main safeguards when a remote repository is configured. No repository publication, cloud build, public deployment or hackathon submission is implied by creating this scaffold.
