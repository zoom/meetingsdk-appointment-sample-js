# Contributing

Thanks for your interest. This is a sample application for the [Zoom developer platform](https://developers.zoom.us), maintained by Zoom Developer Advocacy.

## Before you change anything

This repo is deliberately small. It backs the [Embed Meetings into Your Website](https://github.com/zoom/blueprints/tree/main/blueprints/embed-meetings-website) blueprint, and its job is to show **one idea**: that a Meeting SDK signature should be minted against a booking the server owns, not a meeting number the client sends.

Everything the SDK itself can teach belongs in the canonical samples instead:

- [meetingsdk-web-sample](https://github.com/zoom/meetingsdk-web-sample) for Component View, Client View, and CDN integration
- [meetingsdk-auth-endpoint-sample](https://github.com/zoom/meetingsdk-auth-endpoint-sample) for the signature endpoint with full request validation

So the most useful contribution is usually a deletion. If a change makes this repo look more like a general Meeting SDK demo, it probably belongs upstream in one of those.

## Setup

```bash
git clone https://github.com/zoom/meetingsdk-appointment-sample-js.git
cd meetingsdk-appointment-sample-js
npm install
cp .env.example .env     # then add your Meeting SDK Key and Secret
npm run build
npm start
```

Node 20 or newer.

## Tests

```bash
npm test
```

Node's built-in `node:test` runner, no external framework.

Two rules encode security properties rather than preferences, so think hard before changing a test that asserts them:

1. **The role is derived from the caller's token, never from the request.** A client that can name its own role can host any meeting on the account.
2. **`publicBookingView` must not leak the meeting number, passcode, or access tokens.** The page renders booking details before anyone is authorized to join.

The SDK itself is not covered by automated tests. It runs in a browser against live Zoom infrastructure; verify it by running the sample.

## Never commit credentials

`.env` is gitignored. `.env.example` carries placeholders only. CI runs a secret scan on every PR, and Zoom's push-time scanner also matches key-shaped strings, so even a realistic-looking fake key is rejected.

The SDK **Secret** must never appear in the `web/` directory, in a log line, or in an API response body. The SDK **Key** is public and is returned to the browser on purpose.

## Pull requests

1. Branch from `main`
2. Make sure `npm test` passes and `npm run build` succeeds
3. Say what changed and why
4. If you changed behavior the blueprint describes, say so. The blueprint and this repo have to stay in agreement.

## Security

Do not open a public issue for a security problem. Follow Zoom's [vulnerability disclosure process](https://zoom.us/trust/security).

## Questions

The [Zoom Developer Forum](https://devforum.zoom.us/) is the best place.
