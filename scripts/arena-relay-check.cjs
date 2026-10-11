/* Run with node --env-file=.env --experimental-strip-types scripts/arena-relay-check.cjs. */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { randomUUID } = require('node:crypto');
const ts = require('typescript');
const WebSocket = require('ws');
const { ArenaMatch } = require('../src/features/arena-fighter/arena-match.ts');
const { ArenaRemoteRoom } = require('../src/features/arena-fighter/arena-remote-room.ts');
const {
  remoteCodeFromUUID,
  remoteRoomId,
} = require('../src/features/arena-fighter/arena-invite.ts');
const { validInput, validPacket } = require('../src/features/arena-fighter/arena-protocol.ts');

// Run the installed SDK's actual replication client with Node's native-header adapter.
const filename = path.join(
  path.dirname(require.resolve('@reactvision/react-viro/package.json')),
  'components/AR/ViroReplication.ts'
);
const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const sdk = { exports: {} };
vm.runInNewContext(compiled, {
  exports: sdk.exports,
  module: sdk,
  setTimeout,
  clearTimeout,
  WebSocket: class extends WebSocket {
    constructor(url, _protocols, options) {
      super(url, options);
    }
  },
  require(name) {
    if (name === 'react-native') return { Platform: { OS: 'ios' } };
    if (name === '../Utilities/ViroPlatform') return { isWeb: false };
    if (name === '../Utilities/ViroVersion') return { VIRO_VERSION: '3.0.3' };
    throw new Error('Unexpected SDK dependency');
  },
});
const Client = sdk.exports.ViroReplicationClient;
function until(test, timeout = 15000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const timer = setInterval(() => {
      if (test()) {
        clearInterval(timer);
        resolve();
      } else if (Date.now() - start > timeout) {
        clearInterval(timer);
        reject(new Error('Diagnostic timed out'));
      }
    }, 25);
  });
}
async function main() {
  if (!process.env.RV_API_KEY) throw new Error('RV_API_KEY is missing');
  const endpoint = process.env.RV_REPLICATION_ENDPOINT || 'https://colocation.reactvision.xyz';
  const url = new URL(endpoint);
  if (
    !['https:', 'wss:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    (url.pathname !== '' && url.pathname !== '/') ||
    url.search ||
    url.hash
  )
    throw new Error('Invalid secure endpoint');
  const config = {
    apiKey: process.env.RV_API_KEY,
    projectId: process.env.RV_PROJECT_ID || 'f3eab820-8174-4b7b-a79e-854dab36e16a',
    replicationEndpoint: endpoint,
  };
  const code = remoteCodeFromUUID(randomUUID());
  const host = new ArenaMatch('host', 3, undefined, undefined, 'both', 'remote');
  const guest = new ArenaMatch('guest', 3, undefined, undefined, 'both', 'remote');
  const hostClient = new Client(),
    guestClient = new Client();
  const hostRoom = new ArenaRemoteRoom(host, config, code, hostClient);
  const guestRoom = new ArenaRemoteRoom(guest, config, code, guestClient);
  let failure;
  try {
    await hostRoom.open(new AbortController().signal);
    await guestRoom.open(new AbortController().signal);
    await until(
      () =>
        validInput(hostClient.get('guest')?.fields.input) &&
        validPacket(guestClient.get('host')?.fields.packet)
    );
    console.log(
      JSON.stringify({
        check: 'authenticated-two-client-claim-write-read',
        passed: true,
        hostOwned: hostClient.get('host').owner === hostClient.localPeerId,
        guestOwned: guestClient.get('guest').owner === guestClient.localPeerId,
        hostSessionMatches:
          guest.getSnapshot().space === 'remote' && guest.session === host.session,
      })
    );
    const previousPeer = guestClient.localPeerId;
    guestClient.disconnect();
    guestRoom.retry();
    await until(
      () =>
        guestClient.localPeerId &&
        guestClient.localPeerId !== previousPeer &&
        guestClient.get('guest')?.owner === guestClient.localPeerId &&
        guest.getSnapshot().connected
    );
    console.log(JSON.stringify({ check: 'same-client-seat-reconnect', passed: true }));
  } catch (error) {
    failure = error;
  } finally {
    guestRoom.dispose();
    hostRoom.dispose();
    guest.dispose();
    host.dispose();
    const cleanup = new Client();
    try {
      cleanup.connect({ ...config, endpoint, roomId: remoteRoomId(code) });
      await until(
        () => cleanup.state === 'synced' && cleanup.getEntities().every((entity) => !entity.owner)
      );
      cleanup.clear();
      await until(() => cleanup.getEntities().length === 0);
      console.log(JSON.stringify({ check: 'isolated-room-cleanup', passed: true }));
    } finally {
      cleanup.disconnect();
    }
  }
  if (failure) throw failure;
}
main().catch((error) => {
  // Never print underlying HTTP bodies, credential-bearing URLs, or SDK objects.
  const allowed = ['Diagnostic timed out', 'RV_API_KEY is missing', 'Invalid secure endpoint'];
  console.error(
    JSON.stringify({
      passed: false,
      error: allowed.includes(error.message)
        ? error.message
        : 'Authenticated relay diagnostic failed; inspect sanitized app connection state.',
    })
  );
  process.exitCode = 1;
});
