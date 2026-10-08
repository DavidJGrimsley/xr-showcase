# XR Showcase

An iOS-first MDS Super Stack scaffold for Arena Fighter, Medical Viewer and Guess the Qubit. Android follows. The AR experiences are required implementation tasks, not completed features.

## Development
- Install with npm install.
- Start the development client with npm start.
- Check with npm run typecheck and npm run lint.
- Bundle iOS JavaScript with npm run build:ios.

Use a native development client; Expo Go cannot run Viro. From Windows, sign into EAS, verify the bundle identifier, register the physical iPhone and build the development profile. The simulator profile can test the native shell but cannot prove camera AR acceptance. No EAS project or build was created by this setup.

## Continue implementation
Open a fresh agent session in F:\ReactNativeApps\xr-showcase and run mds continue. Read project/info.md, project/todo.md, project/style.md and project/guidelines.md first. The inspected Unreal game is documented in project/references/guess-the-qubit-unreal.md.

## Pending inputs and validation
Studio credentials/scene readiness, licensed fighter/skull assets, existing Quantum API development-key configuration and physical iPhone testing remain pending. Keep Quantum credentials in device SecureStore when the runtime configuration UI is implemented; keep secrets out of source control, EXPO_PUBLIC variables, logs and project docs. Public distribution requires a backend proxy.

The base MDS generator failed a Windows argument-parsing invocation and then a post-create dependency check. This project preserves its scaffold and repairs those issues locally; see the TODO defect queue and setup validation report for final status.
