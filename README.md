# Meeting SDK Appointment Sample

Embed a live Zoom meeting inside your own page layout using [Meeting SDK](https://developers.zoom.us/docs/meeting-sdk/web/) Component View. A customer opens their appointment page, clicks once, and is in the meeting: no download, no Zoom account, no meeting number typed by hand.

Companion sample for the [Embed Meetings into Your Website](https://github.com/zoom/blueprints/tree/main/blueprints/embed-meetings-website) blueprint.

> **This sample is deliberately small.** It does not re-teach the Meeting SDK. Zoom maintains two canonical samples that already do that, and you should read them alongside this one:
>
> | Repo | What it covers |
> |---|---|
> | [meetingsdk-web-sample](https://github.com/zoom/meetingsdk-web-sample) | Component View, Client View, and CDN variants of the raw SDK integration |
> | [meetingsdk-auth-endpoint-sample](https://github.com/zoom/meetingsdk-auth-endpoint-sample) | The signature endpoint on its own, with full request validation |
>
> What this repo adds is the part those leave out on purpose: **the authorization boundary**. Here the client asks to join a *booking*, never a meeting number, and the server decides which meeting that is and what role the caller gets.

---

## The one idea worth copying

Most Meeting SDK demos have an input box for the meeting number. That is fine for a demo and wrong for a product, because a client that can name its own meeting number can join any meeting on your account, and a client that can name its own role can host it.

So the request looks like this:

```jsonc
// POST /api/signature
{ "bookingId": "bk_1001", "accessToken": "..." }
```

Not this:

```jsonc
{ "meetingNumber": "12345678901", "role": 1 }   // never do this
```

The server resolves the booking, checks the caller is party to it, checks the appointment window is open, and only then looks up the meeting number and picks a role. Everything else in this repo is presentation.

---

## Quick start

```bash
git clone https://github.com/zoom/meetingsdk-appointment-sample-js.git
cd meetingsdk-appointment-sample-js
npm install
cp .env.example .env
```

1. Create a **Meeting SDK** app at [marketplace.zoom.us](https://marketplace.zoom.us/): **Develop** > **Build App** > **Meeting SDK**. Copy the SDK Key and Secret into `.env`.

2. Schedule a meeting in your Zoom client. Put its number and passcode into the seeded booking in [`src/bookings.js`](src/bookings.js), and set `startsAt` to roughly now.

3. Build the page and start the server:

   ```bash
   npm run build
   npm start
   ```

4. Open the customer link the server prints:

   ```
   http://localhost:3000/?booking=bk_1001&token=demo-customer-token
   ```

   The staff link joins the same meeting as host:

   ```
   http://localhost:3000/?booking=bk_1001&token=demo-staff-token
   ```

The tokens in the URL stand in for a session. In a real application the visitor is already logged in, or the link they were emailed carries a signed token.

### Deploy

| Platform | |
|---|---|
| [Deploy to Render](https://render.com/deploy?repo=https://github.com/zoom/meetingsdk-appointment-sample-js) | Uses `render.yaml` |
| [Deploy to Railway](https://railway.app/new?repo=https://github.com/zoom/meetingsdk-appointment-sample-js) | Uses `railway.json` |

Both build the included [Dockerfile](Dockerfile), which is platform-agnostic and runs anywhere containers do.

---

## What's here

```
src/
  server.js       two routes: booking details, and signature minting
  bookings.js     stands in for your appointments table; the authorization boundary
  signature.js    HS256 signing, and only that
web/src/
  App.jsx         the appointment page; mounts the SDK into a div it owns
tests/
  signature.test.js
```

Four source files. That is the whole sample.

### Details that bite

- **`init()` must resolve before `join()`.** Both return promises.
- **The mount element must exist and have a non-zero height before `init()`.** A hidden or zero-height container renders nothing and reports no error, which looks exactly like a bad signature.
- **The passcode goes to `join()` as `password`,** not inside the signature JWT.
- **Signature expiry must sit between 1800 and 172800 seconds.** Zoom rejects anything outside that. `signatureLifetimeSeconds()` scopes it to the appointment and clamps to the range.
- **Every embedding origin must be on your app's domain allow list.** A missing origin fails at `join()`, not `init()`.

---

## Tests

```bash
npm test
```

24 tests over the two things worth testing here: that the signature carries the exact claim set Zoom requires and refuses out-of-range input, and that authorization derives the role from the caller's token rather than from anything the caller sends.

The SDK itself is not tested. It runs in a browser against live Zoom infrastructure, so it is verified by running the sample.

---

## Not production ready

| Simplification here | What production needs |
|---|---|
| `.env` for credentials | A secrets manager |
| Bookings in an in-memory `Map` | Your database, and a real query |
| Access tokens in the URL query string | Your existing session, or a signed single-use link |
| No rate limit on `/api/signature` | Rate limiting per caller. It mints meeting credentials. |
| No logging or audit of who joined what | Record signature issuance against the booking |
| Static build served by Express | Your CDN |

**The signature endpoint is the security model.** If it accepts a meeting number from the client, or signs without checking who is asking, the embed is an open door to every meeting on your account.

**Cross-origin isolation.** Some Meeting SDK features need `Cross-Origin-Opener-Policy` and `Cross-Origin-Embedder-Policy` headers. Check the [Component View docs](https://developers.zoom.us/docs/meeting-sdk/web/component-view/) before assuming a feature is broken.

**Zoom for Government.** The SDK targets a different web endpoint on government accounts. Configure it rather than taking the commercial default; confirm the current parameter in the [Meeting SDK documentation](https://developers.zoom.us/docs/meeting-sdk/web/).

---

## Related

- [Embed Meetings into Your Website](https://github.com/zoom/blueprints/tree/main/blueprints/embed-meetings-website) - the blueprint this backs
- [meetingsdk-web-sample](https://github.com/zoom/meetingsdk-web-sample) - canonical SDK samples
- [meetingsdk-auth-endpoint-sample](https://github.com/zoom/meetingsdk-auth-endpoint-sample) - canonical signature endpoint
- [Meeting SDK authorization](https://developers.zoom.us/docs/meeting-sdk/auth/) - signature format
- [Zoom Developer Forum](https://devforum.zoom.us/) - community support

## License

MIT. See [LICENSE.md](LICENSE.md).
