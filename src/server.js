/**
 * Appointment page backend.
 *
 * Two routes and no framework beyond Express, on purpose. The interesting part
 * is not the plumbing; it is that /api/signature takes a booking id and never
 * a meeting number, so the server decides what a visitor may join.
 */
import path from 'node:path';
import express from 'express';

import { authorizeJoin, findBooking, publicBookingView, signatureLifetimeSeconds } from './bookings.js';
import { createSignature } from './signature.js';

const SDK_KEY = process.env.ZOOM_MEETING_SDK_KEY;
const SDK_SECRET = process.env.ZOOM_MEETING_SDK_SECRET;
const PORT = Number(process.env.PORT ?? 3000);

if (!SDK_KEY || !SDK_SECRET) {
  console.error(
    '\nMissing ZOOM_MEETING_SDK_KEY or ZOOM_MEETING_SDK_SECRET.\n' +
      'Create a Meeting SDK app at https://marketplace.zoom.us and copy them into .env.\n' +
      'See .env.example.\n',
  );
  process.exit(1);
}

const app = express();
app.disable('x-powered-by');
app.use(express.json());

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

/**
 * Booking details for the page to render before anyone clicks Join.
 *
 * Returns the public view only. The meeting number and passcode stay on the
 * server until the caller proves they are party to the booking.
 */
app.get('/api/bookings/:id', (req, res) => {
  const booking = findBooking(req.params.id);
  if (!booking) return res.status(404).json({ error: 'No such booking' });

  return res.json(publicBookingView(booking));
});

/**
 * Mint a signature for one booking.
 *
 * Note what the request body does NOT contain: a meeting number, and a role.
 * Both are derived from the booking. A client that can name its own meeting
 * number can join any meeting on the account; a client that can name its own
 * role can host it.
 */
app.post('/api/signature', (req, res) => {
  const { bookingId, accessToken } = req.body ?? {};
  if (!bookingId) return res.status(400).json({ error: 'bookingId is required' });

  const decision = authorizeJoin(bookingId, accessToken);
  if (!decision.allowed) {
    // 403 rather than 401: the caller is known, the answer is still no.
    return res.status(403).json({ error: decision.reason });
  }

  const { booking, role } = decision;

  const signature = createSignature({
    meetingNumber: booking.meetingNumber,
    role,
    sdkKey: SDK_KEY,
    sdkSecret: SDK_SECRET,
    expiresInSeconds: signatureLifetimeSeconds(booking),
  });

  // The SDK Key is public and the browser needs it. The Secret is not, and
  // never appears in a response body.
  return res.json({
    signature,
    sdkKey: SDK_KEY,
    meetingNumber: booking.meetingNumber,
    passcode: booking.passcode,
    userName: role === 1 ? booking.staffName : booking.customerName,
    role,
  });
});

app.use(express.static(path.resolve('web/dist')));

app.listen(PORT, () => {
  console.log(`Appointment sample listening on http://localhost:${PORT}`);
  console.log(`  customer: http://localhost:${PORT}/?booking=bk_1001&token=demo-customer-token`);
  console.log(`  staff:    http://localhost:${PORT}/?booking=bk_1001&token=demo-staff-token`);
});
