# Starpath Typing Lab

An eight-page story-based physical-keyboard typing prototype for children ages 8–10.

## What this prototype tests

- Can a child read the mission and begin independently?
- Do the key, finger, and movement-path hints provide the right amount of help after a pause?
- Does gentle retry feedback help the child continue without feeling punished?
- Is the end-of-mission accuracy result easy to understand?
- Can a researcher see mistakes, pauses, and hint usage without collecting identity data or a full keystroke stream?

## Data boundary

The story illustration loads as a local site asset. Typing and saving make no network requests. Research events stay in the current browser's `localStorage`, retain at most 12 sessions, and can be cleared from the “On-device data” panel. The project has no account, app login, database, analytics SDK, or cloud sync.

## Run locally

```bash
npm install
npm run dev
```

Validate the build and product boundaries:

```bash
npm test
```

## Story flow

Eight short pages follow a lost fox from the woods to home, with a stream crossing, a rescued mouse, and fireflies who help when the wind puts out the light. Read each page, type it, then rest before continuing. Accuracy covers the whole story; hint and mistake positions are global across pages. Every correct key and error saves a versioned bookmark in this browser. Refreshing or reopening offers Continue the story, preserving the next key, chapter, errors, and the same research session. Chapter boundaries resume at the next reading page. Completion removes the bookmark; Clear progress and data removes both the bookmark and research history. Blocked storage displays a warning and keeps the current in-memory game playable. Invalid or outdated bookmarks are ignored safely.

The fox moves across an illustrated trail on correct keys only. Each chapter changes the journey caption and milestone; the windy hill darkens, the mouse joins after rescue, fireflies return, and the family celebrates at home. Reduced-motion preferences disable movement transitions and the fox hop.
