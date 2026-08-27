import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';

import {
  createSignature,
  ROLE,
  MIN_EXPIRATION_SECONDS,
  MAX_EXPIRATION_SECONDS,
} from '../src/signature.js';
import { authorizeJoin, signatureLifetimeSeconds, publicBookingView, findBooking } from '../src/bookings.js';

const SDK_KEY = 'test-sdk-key';
const SDK_SECRET = 'test-sdk-secret';
const NOW = new Date('2026-08-27T16:55:00.000Z'); // 5 min before the seeded booking

const sign = (overrides = {}) =>
  createSignature({
    meetingNumber: '12345678901',
    role: ROLE.ATTENDEE,
    sdkKey: SDK_KEY,
    sdkSecret: SDK_SECRET,
    now: NOW,
    ...overrides,
  });

describe('createSignature', () => {
  test('should produce a token verifiable with the SDK secret', () => {
    const decoded = jwt.verify(sign(), SDK_SECRET, { algorithms: ['HS256'] });

    assert.equal(decoded.sdkKey, SDK_KEY);
    assert.equal(decoded.appKey, SDK_KEY);
  });

  test('should not verify against a different secret', () => {
    assert.throws(() => jwt.verify(sign(), 'someone-elses-secret'));
  });

  test('should carry the fixed claim set Zoom requires', () => {
    const decoded = jwt.decode(sign());

    for (const claim of ['appKey', 'sdkKey', 'mn', 'role', 'iat', 'exp', 'tokenExp']) {
      assert.ok(claim in decoded, `missing claim: ${claim}`);
    }
  });

  test('should set tokenExp equal to exp', () => {
    const decoded = jwt.decode(sign());

    assert.equal(decoded.tokenExp, decoded.exp);
  });

  test('should send the meeting number as a string', () => {
    const decoded = jwt.decode(sign({ meetingNumber: 12345678901 }));

    assert.equal(decoded.mn, '12345678901');
    assert.equal(typeof decoded.mn, 'string');
  });

  test('should default to the attendee role', () => {
    assert.equal(jwt.decode(sign()).role, 0);
  });

  test('should sign a host token when asked', () => {
    assert.equal(jwt.decode(sign({ role: ROLE.HOST })).role, 1);
  });

  test('should reject a role outside 0 and 1', () => {
    assert.throws(() => sign({ role: 2 }), /role must be 0 or 1/);
  });

  test('should reject an expiry under the Zoom minimum', () => {
    assert.throws(() => sign({ expiresInSeconds: MIN_EXPIRATION_SECONDS - 1 }), /between/);
  });

  test('should reject an expiry over the Zoom maximum', () => {
    assert.throws(() => sign({ expiresInSeconds: MAX_EXPIRATION_SECONDS + 1 }), /between/);
  });

  test('should reject a missing secret rather than signing with undefined', () => {
    assert.throws(() => sign({ sdkSecret: undefined }), /required/);
  });

  test('should use HS256', () => {
    const header = JSON.parse(Buffer.from(sign().split('.')[0], 'base64url').toString('utf8'));

    assert.equal(header.alg, 'HS256');
  });
});

describe('authorizeJoin', () => {
  test('should grant the attendee role for the customer token', () => {
    const decision = authorizeJoin('bk_1001', 'demo-customer-token', NOW);

    assert.equal(decision.allowed, true);
    assert.equal(decision.role, ROLE.ATTENDEE);
  });

  test('should grant the host role for the staff token', () => {
    const decision = authorizeJoin('bk_1001', 'demo-staff-token', NOW);

    assert.equal(decision.allowed, true);
    assert.equal(decision.role, ROLE.HOST);
  });

  test('should refuse an unknown token', () => {
    const decision = authorizeJoin('bk_1001', 'not-a-real-token', NOW);

    assert.equal(decision.allowed, false);
    assert.match(decision.reason, /Not a party/);
  });

  test('should refuse a missing token', () => {
    assert.equal(authorizeJoin('bk_1001', undefined, NOW).allowed, false);
  });

  test('should refuse an unknown booking', () => {
    assert.equal(authorizeJoin('bk_nope', 'demo-customer-token', NOW).allowed, false);
  });

  test('should refuse before the join window opens', () => {
    const tooEarly = new Date('2026-08-27T16:00:00.000Z');
    const decision = authorizeJoin('bk_1001', 'demo-customer-token', tooEarly);

    assert.equal(decision.allowed, false);
    assert.match(decision.reason, /opens at/);
  });

  test('should refuse after the appointment has ended', () => {
    const tooLate = new Date('2026-08-27T19:00:00.000Z');
    const decision = authorizeJoin('bk_1001', 'demo-customer-token', tooLate);

    assert.equal(decision.allowed, false);
    assert.match(decision.reason, /ended/);
  });

  test('should derive the role from the token, ignoring anything else passed', () => {
    // A client that can name its own role can host any meeting on the
    // account. Extra arguments must not influence the decision.
    const decision = authorizeJoin('bk_1001', 'demo-customer-token', NOW, { role: 1 }, 1, 'host');

    assert.equal(decision.allowed, true);
    assert.equal(decision.role, ROLE.ATTENDEE, 'role must come from the token, never the caller');
  });
});

describe('signatureLifetimeSeconds', () => {
  test('should stay inside the range Zoom accepts', () => {
    const booking = findBooking('bk_1001');
    const lifetime = signatureLifetimeSeconds(booking, NOW);

    assert.ok(lifetime >= MIN_EXPIRATION_SECONDS);
    assert.ok(lifetime <= MAX_EXPIRATION_SECONDS);
  });

  test('should clamp to the minimum rather than returning something Zoom rejects', () => {
    const booking = findBooking('bk_1001');
    const nearTheEnd = new Date('2026-08-27T17:59:00.000Z');

    assert.equal(signatureLifetimeSeconds(booking, nearTheEnd), MIN_EXPIRATION_SECONDS);
  });
});

describe('publicBookingView', () => {
  test('should not leak the meeting number, passcode, or access tokens', () => {
    const view = publicBookingView(findBooking('bk_1001'));

    for (const secret of ['meetingNumber', 'passcode', 'accessToken', 'staffAccessToken']) {
      assert.ok(!(secret in view), `publicBookingView leaked ${secret}`);
    }
  });

  test('should include what the page needs to render before joining', () => {
    const view = publicBookingView(findBooking('bk_1001'));

    for (const field of ['subject', 'staffName', 'startsAt', 'durationMinutes']) {
      assert.ok(field in view, `missing field: ${field}`);
    }
  });
});
