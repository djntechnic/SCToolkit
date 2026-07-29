# Responsible use policy

SCToolkit's export features issue real HTTP requests to a third-party website on
the user's behalf. This document states, plainly, how the script behaves — both
so users know what they are running and so site operators can see the intent.

## Commitments

1. **Sequential, single-tab-equivalent.** Requests are serialized through one
   queue, and that queue is throttled across *all* open tabs via shared
   storage. Opening five tabs does not produce five times the request rate.
2. **Human-scale pacing.** Every request is separated by a base delay plus
   randomized jitter. Pacing adapts upward when the site is slow or returns a
   rate-limit signal, and decays back only after sustained success.
3. **Bounded work.** A hard page ceiling caps any single export run. Runs are
   cancellable by the user at any point.
4. **Cache before re-fetch.** Parsed results are cached with a TTL, so repeating
   an export does not repeat the traffic.
5. **Hard stop on any block signal.** Rate-limit responses, challenge pages, and
   access denials abort the run immediately and start a persisted cooldown.
   The script never attempts to solve, bypass, or evade a challenge.
6. **Respects `Retry-After`.** Both the delta-seconds and HTTP-date forms.
7. **No concurrency knob.** Users can make the script slower; they cannot make
   it faster than the built-in floor.

## What this script does not do

- It does not bypass authentication, paywalls, or bot detection.
- It does not solve CAPTCHAs or challenge pages.
- It does not spoof user agents or forge headers to disguise itself.
- It does not crawl. It fetches only the pages a user explicitly asked to export.
- It does not transmit any data anywhere. Exports are generated in the browser
  and saved locally.

## For site operators

If any behaviour here is unwelcome, open an issue at
<https://github.com/djntechnic/SCToolkit/issues> and it will be changed or
removed. Contact is preferred over blocking; the pacing values in this project
are defaults, not demands.

_Implementation lands in Phase 4; the numeric defaults will be listed here once
they are in code rather than in a plan._
