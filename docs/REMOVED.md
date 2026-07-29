# Removed functionality

A record of behaviour deleted during the v3.0 port, kept so nothing is lost
silently. Every entry states the original code, what it was meant to do, and
what would be required to bring it back.

Line references below point into the pre-port v2.42.0 single-file source, which
is retained outside this repository. Each entry quotes the removed code
verbatim, so the reference is a convenience rather than a requirement.

> **Phase 0 status.** Populated during Phase 2. Nothing has been deleted yet.

## Template

### `<name>`

**Removed in:** _(version / PR)_
**Original location:** `legacy/v2.42.0-monolith.user.js:<lines>`

**Intent:** what the code was trying to accomplish.

**Why removed:** the concrete reason (dead selector, never referenced,
superseded, etc.), with the evidence.

**Original code:**

```js
// verbatim
```

**To revive:** what would have to be true — selectors that would need to exist,
what would have to be implemented, where it would attach in the new structure.
