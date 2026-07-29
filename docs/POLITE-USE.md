# Responsible use policy

SCToolkit's export features issue real HTTP requests to a third-party website on
the user's behalf. This document states, plainly, how the script behaves — both
so users know what they are running and so site operators can see the intent.

## Commitments

Each item is marked with what is **in code today** versus what is still
outstanding. Nothing here is claimed before it is implemented.

1. **Sequential, single-tab-equivalent.** ✅ Requests are serialized through one
   queue, and that queue is gated on a request timestamp shared across every
   open tab. Opening five tabs does not produce five times the request rate;
   the tabs interleave at the configured interval.
2. **Human-scale pacing.** ✅ Every request is separated by a base delay
   (default 500 ms) plus randomized jitter (0–700 ms). Pacing adapts upward when
   the site slows or returns a rate-limit signal, and decays back only after
   sustained success — it rises five times faster than it falls. The current
   penalty is shown in the toolbar, so a slowdown is visible rather than
   mysterious.
3. **Bounded work.** ✅ A hard page ceiling (default 200) caps any single run and
   aborts *before* fetching if the discovered page count exceeds it. Every
   request has a timeout (default 30 s), so a hung response cannot stall the
   queue. Runs are cancellable at any point from the toolbar, including during a
   backoff wait.
4. **Cache before re-fetch.** ✅ Parsed results are cached with a TTL (default
   24 h, configurable, 0 to disable). Re-exporting a set within that window
   makes **zero requests**. The cache is capped and purgeable from Settings,
   which also shows what it currently holds.
5. **Hard stop on any block signal.** ✅ Challenge pages, denial pages, and HTTP
   401/403 abort the run immediately and start a persisted cooldown (default
   5 minutes) during which new exports are refused. Detection covers reCAPTCHA,
   hCaptcha, and JavaScript-challenge interstitials. The script never attempts
   to solve, bypass, or evade a challenge.
6. **Respects `Retry-After`.** ✅ Both the delta-seconds and HTTP-date forms, on
   HTTP 429 and 503, falling back to capped exponential backoff.
7. **No concurrency knob.** ✅ Users can make the script slower; there is no
   setting that makes it faster than the built-in floor, and none that permits
   parallel requests.

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
| Adaptive pacing penalty | 0 ms, +500 ms per strain signal | capped at 8 s |
| Retries per page on 429/503 | 3 | 0 |
| Backoff base / cap | 1 s / 15 s | 250 ms / 2 s |
| Per-request timeout | 30 s | 5 s |
| Page ceiling per run | 200 | 20 |
| Cooldown after a detected block | 5 min | 0 (user-disableable) |
| Export cache lifetime | 24 h | 0 (user-disableable) |

All are user-adjustable in Settings within those bounds. There is no setting
that removes the delay or runs requests in parallel.

The delay actually used between requests is
`base + adaptive penalty + random jitter`, and the same interval gates every
tab, not just the one that started the export.
