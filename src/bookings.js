/**
 * Stands in for your appointments table.
 *
 * The shape matters more than the storage. Every field the signature endpoint
 * needs to make an authorization decision lives on the booking, so the client
 * never has to supply a meeting number and the server never has to trust one.
 *
 * Replace this file with a real query. Nothing else changes.
 */

/** Minutes before the appointment start that joining opens. */
const JOIN_WINDOW_BEFORE_MINUTES = 15;

/** Minutes after the appointment end that joining closes. */
const JOIN_WINDOW_AFTER_MINUTES = 30;

const BOOKINGS = new Map([
  [
    'bk_1001',
    {
      id: 'bk_1001',
      customerName: 'Alex Rivera',
      // Token the customer's emailed link carries. Stands in for a session.
      accessToken: 'demo-customer-token',
      staffName: 'Jordan Blake',
      staffAccessToken: 'demo-staff-token',
      subject: 'Portfolio review',
      // Put a real scheduled meeting here to try the sample.
      meetingNumber: '00000000000',
      passcode: 'YOUR_MEETING_PASSCODE_HERE',
      startsAt: '2026-08-27T17:00:00.000Z',
      durationMinutes: 30,
    },
  ],
]);

export function findBooking(bookingId) {
  return BOOKINGS.get(bookingId);
}

/**
 * Decide whether this caller may join this booking, and as what.
 *
 * This is the authorization boundary for the whole sample. Everything
 * downstream trusts its answer, so it returns a reason on every rejection
 * rather than a bare false.
 *
 * @returns {{allowed: true, role: 0|1, booking: object} | {allowed: false, reason: string}}
 */
export function authorizeJoin(bookingId, accessToken, now = new Date()) {
  const booking = findBooking(bookingId);
  if (!booking) return { allowed: false, reason: 'No such booking' };

  // Role comes from which token was presented, never from the request body.
  // A client that can ask for role 1 can host any meeting on the account.
  let role;
  if (accessToken && accessToken === booking.staffAccessToken) role = 1;
  else if (accessToken && accessToken === booking.accessToken) role = 0;
  else return { allowed: false, reason: 'Not a party to this booking' };

  const startsAt = new Date(booking.startsAt);
  const opensAt = new Date(startsAt.getTime() - JOIN_WINDOW_BEFORE_MINUTES * 60_000);
  const closesAt = new Date(
    startsAt.getTime() + (booking.durationMinutes + JOIN_WINDOW_AFTER_MINUTES) * 60_000,
  );

  if (now < opensAt) {
    return { allowed: false, reason: `Joining opens at ${opensAt.toISOString()}` };
  }
  if (now > closesAt) {
    return { allowed: false, reason: 'This appointment has ended' };
  }

  return { allowed: true, role, booking };
}

/**
 * How long the signature should live: until the join window closes, clamped to
 * the range Zoom accepts. An appointment at 3pm does not need a token minted
 * at 9am that is valid all day.
 */
export function signatureLifetimeSeconds(booking, now = new Date()) {
  const startsAt = new Date(booking.startsAt);
  const closesAt = new Date(
    startsAt.getTime() + (booking.durationMinutes + JOIN_WINDOW_AFTER_MINUTES) * 60_000,
  );

  const remaining = Math.ceil((closesAt.getTime() - now.getTime()) / 1000);
  return Math.min(Math.max(remaining, 1800), 172800);
}

/** Safe to send to the browser. Note the absence of meetingNumber and passcode. */
export function publicBookingView(booking) {
  return {
    id: booking.id,
    customerName: booking.customerName,
    staffName: booking.staffName,
    subject: booking.subject,
    startsAt: booking.startsAt,
    durationMinutes: booking.durationMinutes,
  };
}
