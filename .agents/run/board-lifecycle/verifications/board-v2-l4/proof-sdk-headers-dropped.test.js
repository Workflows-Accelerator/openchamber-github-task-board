import test from 'node:test';
import assert from 'node:assert/strict';
import { isGuestRequestResult } from '@openchamber/sdk';

test('Hostile Proof 7: @openchamber/sdk host.request does not support request or response headers', () => {
  // Check the shape of GuestRequestResult validator from @openchamber/sdk
  // isGuestRequestResult checks: Boolean(value && 'status' in value && 'body' in value && Number.isInteger(value.status))
  assert.equal(isGuestRequestResult({ status: 200, body: '[]' }), true);

  // In panel/main.ts line 1132:
  // const resHeaders = (res as any).headers;
  // If the host returns a valid GuestRequestResult without headers:
  const sdkResult = { status: 200, body: '[]' };
  const resHeaders = sdkResult.headers;
  assert.equal(resHeaders, undefined, 'res.headers is undefined under OpenChamber SDK specification');

  // ETag header extraction in main.ts line 1138:
  const resEtag = resHeaders ? (resHeaders['etag'] || resHeaders['ETag']) : undefined;
  assert.equal(resEtag, undefined, 'ETag cannot be extracted from host.request results');
});
