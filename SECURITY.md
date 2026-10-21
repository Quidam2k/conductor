# Security Policy

Conductor runs entirely in the browser. There's no server, no accounts, and no data collection. Events travel inside links, and optional passwords encrypt them with AES-256-GCM. People may use it to coordinate demonstrations, so we take its safety seriously.

## Reporting a vulnerability

Please **don't** open a public issue. Use GitHub's [private vulnerability reporting](https://github.com/Quidam2k/conductor/security/advisories/new) instead. Include what you found, how to reproduce it, and what an attacker could do with it.

Examples of things we want to hear about:

- An event link or QR code that runs script, exhausts memory, or crashes the app on another phone
- Weaknesses in event encryption (`v1e_` codes) or the password flow
- A resource pack (zip) that can do more than play audio
- Anything that leaks an event's contents, a participant's location, or their identity

We'll acknowledge reports as quickly as we can, which is usually within a week. Fixes ship in the next build. Only the latest build on [the public site](https://quidam2k.github.io/conductor/) is supported.

## Know the limits

- Anyone holding an unencrypted event link can read the event. Use a password for anything sensitive, and share the password separately.
- Everyone's phone runs on its own clock. Conductor doesn't sync time over the network, so phones set to automatic time stay closest together.
