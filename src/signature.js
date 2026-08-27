/**
 * Meeting SDK signature minting.
 *
 * The SDK Secret is the credential that lets anyone join any meeting on your
 * account as host. It lives here and nowhere else: not in the bundle, not in a
 * log line, not in an API response.
 *
 * The claim set below is fixed by Zoom. See
 * https://developers.zoom.us/docs/meeting-sdk/auth/
 */
import jwt from 'jsonwebtoken';

/** Zoom rejects a signature whose lifetime falls outside this window. */
export const MIN_EXPIRATION_SECONDS = 1800; // 30 minutes
export const MAX_EXPIRATION_SECONDS = 172800; // 48 hours

export const ROLE = Object.freeze({ ATTENDEE: 0, HOST: 1 });

/**
 * @param {object} args
 * @param {string|number} args.meetingNumber
 * @param {0|1} args.role
 * @param {string} args.sdkKey
 * @param {string} args.sdkSecret
 * @param {number} args.expiresInSeconds
 * @param {Date} [args.now] injectable for tests
 * @returns {string} the signature JWT
 */
export function createSignature({
  meetingNumber,
  role,
  sdkKey,
  sdkSecret,
  expiresInSeconds = MIN_EXPIRATION_SECONDS,
  now = new Date(),
}) {
  if (!sdkKey || !sdkSecret) {
    throw new Error('sdkKey and sdkSecret are required');
  }
  if (role !== ROLE.ATTENDEE && role !== ROLE.HOST) {
    throw new Error(`role must be 0 or 1, got: ${role}`);
  }
  if (expiresInSeconds < MIN_EXPIRATION_SECONDS || expiresInSeconds > MAX_EXPIRATION_SECONDS) {
    throw new Error(
      `expiresInSeconds must be between ${MIN_EXPIRATION_SECONDS} and ${MAX_EXPIRATION_SECONDS}`,
    );
  }

  const iat = Math.floor(now.getTime() / 1000);
  const exp = iat + expiresInSeconds;

  return jwt.sign(
    {
      appKey: sdkKey,
      sdkKey,
      mn: String(meetingNumber),
      role,
      iat,
      exp,
      tokenExp: exp,
    },
    sdkSecret,
    { algorithm: 'HS256' },
  );
}
