import assert from 'node:assert/strict';
import test from 'node:test';
import { parseBookmark, isSession } from '../app/progress.ts';

const chapters = ['a fox.', 'home.'];
const version = 'story-test';
function bookmark(overrides = {}) {
  return { version: 1, taskVersion: version, chapterIndex: 0, position: 2, phase: 'paused',
    session: { id: 'session-one', taskVersion: version, startedAt: '2026-09-07T06:00:00Z', status: 'active',
      errors: [{ position: 0, expected: 'a', received: 'x' }], pauses: [], hints: [{ position: 0, expected: 'a', level: 2, reason: 'error' }] },
    ...overrides };
}
const parse = (saved) => parseBookmark(JSON.stringify(saved), version, chapters);

test('mid-page resume keeps the same session, next key and mistakes', () => {
  const saved = parse(bookmark());
  assert.equal(saved.position, 2);
  assert.equal(chapters.join('')[saved.position], 'f');
  assert.equal(saved.session.id, 'session-one');
  assert.equal(saved.session.errors.length, 1);
});

test('chapter boundary resumes reading the next page', () => {
  const saved = parse(bookmark({ chapterIndex: 1, position: 6, phase: 'read' }));
  assert.equal(saved.chapterIndex, 1);
  assert.equal(saved.phase, 'read');
  assert.equal(chapters.join('')[saved.position], 'h');
});

test('rejects old versions, completed stories, and inconsistent positions', () => {
  for (const override of [
    { version: 2 }, { taskVersion: 'old' }, { chapterIndex: -1 }, { chapterIndex: 2 },
    { position: -1 }, { position: 2.5 }, { position: 6 }, { position: 11 },
    { phase: 'done' }, { phase: 'read', position: 2 }, { chapterIndex: 1, position: 2 },
    { session: { ...bookmark().session, status: 'complete' } },
    { session: { ...bookmark().session, taskVersion: 'old' } },
  ]) assert.equal(parse(bookmark(override)), null, JSON.stringify(override));
});

test('handles malformed storage and corrupt research data safely', () => {
  for (const raw of [null, '', '{', 'null', '[]', '{}']) assert.equal(parseBookmark(raw, version, chapters), null);
  for (const session of [null, {}, { ...bookmark().session, errors: null },
    { ...bookmark().session, hints: [{ position: 0, expected: 'a', level: 20, reason: 'error' }] },
    { ...bookmark().session, pauses: [{ position: 0, expected: 'a', durationMs: -2 }] },
  ]) assert.equal(isSession(session), false);
  assert.equal(parse(bookmark({ session: { ...bookmark().session, errors: [{ position: 9, expected: 'e', received: 'x' }] } })), null);
  assert.equal(parse(bookmark({ session: { ...bookmark().session, errors: [{ position: 0, expected: 'z', received: 'x' }] } })), null);
});
