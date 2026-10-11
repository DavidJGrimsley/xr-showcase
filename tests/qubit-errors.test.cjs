const assert = require('node:assert/strict');
const { test } = require('node:test');
const {
  qubitFailure,
  qubitConnectionMessage,
  qubitRoundMessage,
  qubitRetryMessage,
} = require('../src/features/guess-the-qubit/qubit-errors.ts');

test('unknown errors and malformed metadata are sanitized with fixed error codes', () => {
  for (const value of [
    null,
    undefined,
    'private-key',
    new Error('private-key'),
    { code: 'private-key', status: '401', retryAt: 'Infinity' },
  ]) {
    assert.deepEqual(qubitFailure(value), { code: 'network', status: 0, retryAt: 0 });
  }
  assert.deepEqual(qubitFailure({ code: 'timeout', status: Infinity, retryAt: NaN }), {
    code: 'timeout',
    status: 0,
    retryAt: 0,
  });
  assert.deepEqual(qubitFailure({ retryAt: 60000, status: 429 }), {
    code: 'rate_limit',
    status: 429,
    retryAt: 60000,
  });
  assert.equal(
    qubitRetryMessage('Service busy.', 60000, 15001),
    'Service busy. Retry available in 45s.'
  );
  assert.equal(qubitRetryMessage('Service busy.', 60000, 60000), 'Service busy.');
});

test('authentication errors do not instruct players to reset a round to fix service access', () => {
  assert.match(qubitConnectionMessage('credentials'), /access denied/);
  assert.match(qubitRoundMessage('credentials', false), /Reload the updated app/);
  assert.equal(qubitRoundMessage('credentials', false).includes('Reset Qubit'), false);
});

test('polling failures explain recovery of the existing job and simulator failures explain Reset', () => {
  for (const code of ['network', 'timeout', 'rate_limit', 'unavailable']) {
    assert.match(qubitRoundMessage(code, true), /existing job automatically/);
    assert.match(qubitRoundMessage(code, false), /Reset Qubit/);
  }
});
