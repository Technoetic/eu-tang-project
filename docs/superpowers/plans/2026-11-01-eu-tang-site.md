# Eu-Tang project website Implementation Plan

> For agentic workers: execute the bounded file ownership in the spec; owner handles Sites calls and publication.

**Goal:** Create a Korean music project homepage based on the supplied actual video and two beats.

**Architecture:** Static HTML with separated CSS and class-owned JS services/screens. A dependency-free Node build creates a versioned asset graph, entry build ID and fresh version endpoint.

**Tech Stack:** HTML, CSS, ES modules, native audio/dialog, Node built-ins, Sites, Aside CLI.

**Spec:** docs/superpowers/specs/2026-11-01-eu-tang-site-design.md

## Global constraints

- Preserve the original beat usage restriction and source identity; no unverified project claims.
- Use actual provided media, click-to-play only, private audience, no new backend or personal-data form.
- Respect webapp six principles; content/hash routes share one entry; media is not interrupted by background version checks.

## Review focus

- A rejected older play promise must not replace the newer track's state.
- A failed play or media request must show recoverable failure, never a false playing state.
- A version rollback differs from loaded identity and applies on the next clean document navigation.
- Failed version requests and playing audio must preserve the current experience.
- 390px layouts, native dialog, keyboard buttons and direct hash links must work without overflow.

### Task 1: Supplied media and presentation

- [ ] Fetch/validate source media, retain source hashes and restrictions.
- [ ] Implement original responsive presentation using the exact DOM contract.
- [ ] Inspect actual rendered 1440px and 390px layouts with Aside.

### Task 2: Playback and safe navigation

- [ ] Write focused behavioral tests for track-switch races, rejected play and build-change/error decisions; run RED.
- [ ] Implement native-audio state service, data service, screen and version controller.
- [ ] Run focused tests GREEN and actual browser playback/interaction checks.

### Task 3: Publication

- [ ] Build matching versioned output and verify static/media paths and 404 behavior.
- [ ] Run independent source/browser checks; record limits truthfully.
- [ ] Push exact source with Sites source helper, package it, privately deploy once, confirm terminal deployment URL.


## Hosting change (2026-11-01)

The user subsequently requested public GitHub Pages hosting. The current deployment uses a sanitized standalone repository and /eu-tang-project/ base path. The earlier private Sites instructions above describe the first implementation, not the current publishing target. No Sites identity, token, or private source history is included.
