# XR Showcase

An iOS-first tabletop AR app with Neo Rock 'Em Sock 'Em Robots, Medical Viewer and Guess the Qubit. Medical Viewer includes scan-derived anatomy models, registered CT/MRI slices and a 48-layer scan preview. Its experimental GPU volume renderer remains unverified on iPhone; the [investigation kit](https://github.com/DavidJGrimsley/xr-showcase-project/tree/docs/3d-scan-limitations/3D_Scan_Limitations) records the limitation and evidence.

## Development

Use Node 22.13 or newer and the pinned npm lockfile. Expo SDK 57 requires React Native 0.86 and a native Viro development client; Expo Go cannot run this app.

```sh
npm ci
npm start
```

Use your own private development configuration and signing when building a client with the EAS `development` profile. A simulator can check the shell but cannot verify camera AR. Credentials remain outside committed files.

```sh
npm test
npm run build:ios
mds report . --kind content
mds doctor . --ci
```

`build:ios` exports JavaScript and assets; it is not a native device build. Canonical project memory and TODOs are in the separate [project repository](https://github.com/DavidJGrimsley/xr-showcase-project); this checkout's legacy `project/` files are historical migration inputs.

## Dependency compatibility

SDK 57's `query-string@7.1.3` expects a synchronous CommonJS URI decoder. The security-fixed `decode-uri-component@0.5.0` is ESM-only, so `npm ci` runs `tools/compat/prepare-uri-decoder.cjs` to generate a CommonJS export of the unchanged, checksum-verified upstream algorithm. The original ESM entry remains available. Keep install scripts enabled. Changing the decoder version requires reviewing the bridge and updating its checksum.

The `xcode@3.0.1` dependency uses `uuid@11.1.1` through a scoped override; compatibility tests cover Xcode identifiers, UUID buffer bounds, normal query round trips and malformed URI input.

As of October 12, 2026, npm audit still reports 19 affected package entries inherited from two upstream advisories: [braces](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) and [node-forge](https://github.com/advisories/GHSA-86w9-cpqp-85rv). Neither has a published patched release. They are tracked in the project repository; unsupported SDK downgrades or major upgrades are not applied to silence audit results.
