# Responsible use policy

SCToolkit's export features issue real HTTP requests to a third-party website on
the user's behalf. This document states, plainly, how the script behaves — both
so users know what they are running and so site operators can see the intent.

## Commitments

Each item is marked with what is **in code today** versus what is still
outstanding. Nothing here is claimed before it is implemented.

1. **Sequential.** ✅ Requests are serialized through one queue; a second export
   waits for the first to finish.
   ⏳ *Outstanding:* the queue is per-tab, so two tabs exporting at once produce
   two request streams. Cross-tab throttling via shared storage is the highest
   priority remaining item.
2. **Human-scale pacing.** ✅ Every request after the first is separated by a
   base delay (default 500 ms) plus randomized jitter (0–700 ms).
   ⏳ *Outstanding:* pacing does not yet adapt upward when the site slows.
3. **Bounded work.** ✅ A hard page ceiling (default 200) caps any single run and
   aborts *before* fetching if the discovered page count exceeds it.
   ⏳ *Outstanding:* runs are not yet cancellable mid-flight, and requests have
   no timeout.
4. **Cache before re-fetch.** ⏳ *Outstanding.* Re-exporting a set currently
   re-fetches every page.
5. **Hard stop on any block signal.** ✅ A challenge or access-denied page aborts
   the run immediately and starts a persisted cooldown (default 5 minutes)
   during which new exports are refused. The script never attempts to solve,
   bypass, or evade a challenge.
   ⏳ *Outstanding:* detection covers three markers and misses newer challenge
   formats.
6. **Respects `Retry-After`.** ✅ Both the delta-seconds and HTTP-date forms, on
   HTTP 429 and 503, falling back to capped exponential backoff.
7. **No concurrency knob.** ✅ Users can make the script slower; there is no
   setting that makes it faster than the built-in floor.

Outstanding items are Phase 4 of the plan and are tracked in
[CHANGELOG.md](../CHANGELOG.md).

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

## Current defaults

| Setting | Default | Floor |
|---|---|---|
| Base delay between requests | 500 ms | 200 ms |
| Random jitter added | 0–700 ms | 0 |
| Retries per page on 429/503 | 3 | 0 |
| Backoff base / cap | 1 s / 15 s | 250 ms / 2 s |
| Page ceiling per run | 200 | 20 |
| Cooldown after a detected block | 5 min | 0 (user-disableable) |

All are user-adjustable in Settings within those bounds. There is no setting
that removes the delay or runs requests in parallel.
