import { useEffect, useRef, useState } from 'react';
import ZoomMtgEmbedded from '@zoom/meetingsdk/embedded';

/**
 * The appointment page.
 *
 * Three states: booking details, joining, in the meeting. The Zoom client
 * mounts into #meeting-root, which sits inside this page's layout rather than
 * replacing it, so the sidebar stays visible for the whole call.
 */
export function App() {
  const params = new URLSearchParams(window.location.search);
  const bookingId = params.get('booking');
  const accessToken = params.get('token');

  const [booking, setBooking] = useState(null);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(null);

  const rootRef = useRef(null);
  const clientRef = useRef(null);

  // Render the booking before anyone clicks anything. A page that is blank
  // until the SDK loads looks broken.
  useEffect(() => {
    if (!bookingId) {
      setError('No booking in the URL. Try the link printed by the server.');
      setStatus('error');
      return;
    }

    fetch(`/api/bookings/${encodeURIComponent(bookingId)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('Booking not found'))))
      .then((b) => {
        setBooking(b);
        setStatus('ready');
      })
      .catch((err) => {
        setError(err.message);
        setStatus('error');
      });
  }, [bookingId]);

  // Tear the client down on unmount so a route change does not leave a live
  // meeting attached to a removed node.
  useEffect(() => () => clientRef.current?.leaveMeeting?.().catch(() => {}), []);

  async function join() {
    setStatus('joining');
    setError(null);

    try {
      // The signature is requested on the click, not on page load. One minted
      // at load is already expiring while the visitor reads the page.
      const response = await fetch('/api/signature', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ bookingId, accessToken }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? 'Could not authorize this booking');

      const client = ZoomMtgEmbedded.createClient();
      clientRef.current = client;

      // init() must resolve before join(), and the root element must already
      // be mounted with a non-zero size or the SDK renders nothing silently.
      await client.init({
        zoomAppRoot: rootRef.current,
        language: 'en-US',
        patchJsMedia: true,
      });

      await client.join({
        signature: data.signature,
        meetingNumber: data.meetingNumber,
        userName: data.userName,
        password: data.passcode,
      });

      setStatus('in-meeting');
    } catch (err) {
      // An expired signature and a meeting that has not started fail
      // differently and read identically if you only log them.
      setError(err.reason ?? err.message ?? 'Could not join the meeting');
      setStatus('ready');
    }
  }

  return (
    <main className="page">
      <header className="page-header">
        <span className="brand">Northwind Advisors</span>
        <span className="crumb">Your appointment</span>
      </header>

      <div className="layout">
        <section className="stage">
          {/* The SDK renders here. Kept mounted for the whole session. */}
          <div id="meeting-root" ref={rootRef} className="meeting-root" />

          {status !== 'in-meeting' && (
            <div className="stage-overlay">
              {status === 'loading' && <p>Loading your appointment...</p>}

              {status === 'error' && <p className="error">{error}</p>}

              {(status === 'ready' || status === 'joining') && booking && (
                <>
                  <h1>{booking.subject}</h1>
                  <p className="with">with {booking.staffName}</p>
                  <p className="when">{new Date(booking.startsAt).toLocaleString()}</p>

                  {error && <p className="error">{error}</p>}

                  <button type="button" onClick={join} disabled={status === 'joining'}>
                    {status === 'joining' ? 'Joining...' : 'Join your appointment'}
                  </button>

                  <p className="fine">No download required. Opens right here.</p>
                </>
              )}
            </div>
          )}
        </section>

        <aside className="sidebar">
          <h2>Appointment</h2>
          {booking && (
            <dl>
              <dt>Client</dt>
              <dd>{booking.customerName}</dd>
              <dt>Advisor</dt>
              <dd>{booking.staffName}</dd>
              <dt>Length</dt>
              <dd>{booking.durationMinutes} minutes</dd>
            </dl>
          )}
          <p className="fine">
            This panel stays visible during the call. That is the point of Component View: the
            meeting joins your page instead of replacing it.
          </p>
        </aside>
      </div>
    </main>
  );
}
