# Starpath Typing Lab

A one-mission physical-keyboard typing prototype for children ages 8–10.

## What this prototype tests

- Can a child read the mission and begin independently?
- Do the key, finger, and movement-path hints provide the right amount of help after a pause?
- Does gentle retry feedback help the child continue without feeling punished?
- Is the end-of-mission accuracy result easy to understand?
- Can a researcher see mistakes, pauses, and hint usage without collecting identity data or a full keystroke stream?

## Data boundary

The mission makes no network requests while running. Research events stay in the current browser's `localStorage`, retain at most 12 sessions, and can be cleared from the “On-device data” panel. The project has no account, app login, database, analytics SDK, or cloud sync.

## Run locally

```bash
npm install
npm run dev
```

Validate the build and product boundaries:

```bash
npm test
```
