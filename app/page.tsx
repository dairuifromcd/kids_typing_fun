"use client";

import { isSession, parseBookmark, type Bookmark, type StoredSession } from "./progress";
import { Journey } from "./journey";

import { useCallback, useEffect, useRef, useState } from "react";

const STORY = [
  { title: "A lost little fox", text: "the sun has set. a little fox is lost in the woods.", reward: "You found the little fox. Now we can help!" },
  { title: "A friendly light", text: "a firefly sees the fox. she lights a path to a quiet stream.", reward: "A new friend is lighting the way." },
  { title: "Across the stream", text: "the fox stops by the water. a kind frog shows him a bridge of flat stones.", reward: "Across safely, one careful step at a time!" },
  { title: "A friend needs help", text: "on the far bank, a mouse is stuck under a twig. the fox lifts it with his nose.", reward: "The mouse is free. Kindness makes a new friend." },
  { title: "The windy hill", text: "the mouse knows the way home. they climb a hill, but the wind blows out the light.", reward: "The light is gone, but your friends are still here." },
  { title: "Stars in the grass", text: "the fox calls for help. more fireflies arrive. they glow like tiny stars in the grass.", reward: "Together, the fireflies make a brighter path." },
  { title: "The light at home", text: "at the top, the fox sees a warm light. his family is waiting by the door of their den.", reward: "Home is in sight. Just one more page!" },
  { title: "Home together", text: "the fox runs home and hugs his family. he shares his supper with his new friends. no one walks home alone.", reward: "The little fox is home, and everyone has a friend." },
];
const TASK_TEXT = STORY.map((chapter) => chapter.text).join("");
const WORD_COUNT = STORY.reduce((total, part) => total + part.text.split(/\s+/).length, 0);
const BOOKMARK_KEY = "starpath-story-bookmark-v1";
const STORAGE_KEY = "starpath-typing-research-v1";
const TASK_VERSION = "moon-fox-story-02";

const KEY_ROWS = [
  ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
  ["a", "s", "d", "f", "g", "h", "j", "k", "l", ";"],
  ["z", "x", "c", "v", "b", "n", "m", ",", "."],
];

type FingerSide = "Left hand" | "Right hand" | "Both hands";
type FingerName = "Pinky" | "Ring" | "Middle" | "Index" | "Thumb";

type KeyGuide = {
  side: FingerSide;
  finger: FingerName;
  home: string;
  move: string;
};

const KEY_GUIDES: Record<string, KeyGuide> = {
  q: { side: "Left hand", finger: "Pinky", home: "A", move: "up-left" },
  a: { side: "Left hand", finger: "Pinky", home: "A", move: "stay here" },
  z: { side: "Left hand", finger: "Pinky", home: "A", move: "down-right" },
  w: { side: "Left hand", finger: "Ring", home: "S", move: "up-left" },
  s: { side: "Left hand", finger: "Ring", home: "S", move: "stay here" },
  x: { side: "Left hand", finger: "Ring", home: "S", move: "down-right" },
  e: { side: "Left hand", finger: "Middle", home: "D", move: "up-left" },
  d: { side: "Left hand", finger: "Middle", home: "D", move: "stay here" },
  c: { side: "Left hand", finger: "Middle", home: "D", move: "down-right" },
  r: { side: "Left hand", finger: "Index", home: "F", move: "up-left" },
  f: { side: "Left hand", finger: "Index", home: "F", move: "stay here" },
  v: { side: "Left hand", finger: "Index", home: "F", move: "down-right" },
  t: { side: "Left hand", finger: "Index", home: "F", move: "up-right" },
  g: { side: "Left hand", finger: "Index", home: "F", move: "right" },
  b: { side: "Left hand", finger: "Index", home: "F", move: "down-right" },
  y: { side: "Right hand", finger: "Index", home: "J", move: "up-left" },
  h: { side: "Right hand", finger: "Index", home: "J", move: "left" },
  n: { side: "Right hand", finger: "Index", home: "J", move: "down-left" },
  u: { side: "Right hand", finger: "Index", home: "J", move: "up-right" },
  j: { side: "Right hand", finger: "Index", home: "J", move: "stay here" },
  m: { side: "Right hand", finger: "Index", home: "J", move: "down-left" },
  i: { side: "Right hand", finger: "Middle", home: "K", move: "up-right" },
  k: { side: "Right hand", finger: "Middle", home: "K", move: "stay here" },
  ",": { side: "Right hand", finger: "Middle", home: "K", move: "down-left" },
  o: { side: "Right hand", finger: "Ring", home: "L", move: "up-right" },
  l: { side: "Right hand", finger: "Ring", home: "L", move: "stay here" },
  ".": { side: "Right hand", finger: "Ring", home: "L", move: "down-left" },
  p: { side: "Right hand", finger: "Pinky", home: ";", move: "up-right" },
  " ": { side: "Both hands", finger: "Thumb", home: "SPACE", move: "press gently" },
};

type StorageEnvelope = {
  version: 1;
  sessions: StoredSession[];
};

type LocalSummary = {
  sessions: number;
  errors: number;
  pauses: number;
  hints: number;
};

const EMPTY_SUMMARY: LocalSummary = {
  sessions: 0,
  errors: 0,
  pauses: 0,
  hints: 0,
};

const FINGERS: FingerName[] = ["Pinky", "Ring", "Middle", "Index", "Thumb"];
const HOME_KEYS: Record<string, string> = {
  a: "Left pinky", s: "Left ring", d: "Left middle", f: "Left index",
  j: "Right index", k: "Right middle", l: "Right ring", ";": "Right pinky",
};
const HAND_HOMES = {
  "Left hand": ["A", "S", "D", "F", "SPACE"],
  "Right hand": [";", "L", "K", "J", "SPACE"],
};

function HomeHands({ activeSide, activeFinger }: { activeSide?: FingerSide; activeFinger?: FingerName }) {
  return (
    <div className="hands" aria-label="Starting finger positions">
      {(["Left hand", "Right hand"] as const).map((side) => (
        <div className="hand" key={side}>
          <span className="hand-name">{side}</span>
          <div className={`fingers ${side === "Right hand" ? "right-hand" : ""}`}>
            {FINGERS.map((finger, index) => {
              const home = HAND_HOMES[side][index];
              const active = (activeSide === side || activeSide === "Both hands") && activeFinger === finger;
              return (
                <span className={`finger ${active ? "active-finger" : ""}`} key={finger}
                  role="img" aria-label={`${side} ${finger}: start on ${home}`} title={`${finger}: ${home}`}>
                  <span className="finger-initial" aria-hidden="true">{finger.slice(0, 1)}</span>
                  <strong aria-hidden="true">{home === "SPACE" ? "␣" : home}</strong>
                </span>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}


function readStorage(): StorageEnvelope {
  if (typeof window === "undefined") {
    return { version: 1, sessions: [] };
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { version: 1, sessions: [] };
    const parsed = JSON.parse(raw) as StorageEnvelope;
    if (parsed.version !== 1 || !Array.isArray(parsed.sessions)) {
      return { version: 1, sessions: [] };
    }
    return { version: 1, sessions: parsed.sessions.filter(isSession) };
  } catch {
    return { version: 1, sessions: [] };
  }
}

function summarizeLocalData(): LocalSummary {
  const sessions = readStorage().sessions;
  return sessions.reduce<LocalSummary>(
    (summary, session) => ({
      sessions: summary.sessions + (session.status === "complete" ? 1 : 0),
      errors: summary.errors + session.errors.length,
      pauses: summary.pauses + session.pauses.length,
      hints: summary.hints + session.hints.length,
    }),
    { ...EMPTY_SUMMARY },
  );
}

function keyLabel(key: string) {
  return key === " " ? "SPACE" : key.toUpperCase();
}

function createSession(): StoredSession {
  return {
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `session-${Date.now()}`,
    taskVersion: TASK_VERSION,
    startedAt: new Date().toISOString(),
    status: "active",
    errors: [],
    pauses: [],
    hints: [],
  };
}

export default function Home() {
  const [phase, setPhase] = useState<"read" | "type" | "paused" | "resume" | "done">("read");
  const [ready, setReady] = useState(false);
  const bookmarkRef = useRef<Omit<Bookmark, "session"> | null>(null);
  const [chapterIndex, setChapterIndex] = useState(0);
  const [position, setPosition] = useState(0);
  const [errorCount, setErrorCount] = useState(0);
  const [hintLevel, setHintLevel] = useState(0);
  const [feedback, setFeedback] = useState("Take your time. Find the first letter.");
  const [isErrorFlash, setIsErrorFlash] = useState(false);
  const [dataOpen, setDataOpen] = useState(false);
  const [localSummary, setLocalSummary] = useState<LocalSummary>(EMPTY_SUMMARY);
  const [storageAvailable, setStorageAvailable] = useState(true);
  const dialogRef = useRef<HTMLDivElement>(null);
  const chapterButtonRef = useRef<HTMLButtonElement>(null);
  const practiceRef = useRef<HTMLDivElement>(null);
  const sessionRef = useRef<StoredSession | null>(null);
  const hintKeysRef = useRef(new Set<string>());
  const pauseKeysRef = useRef(new Set<number>());

  const chapter = STORY[chapterIndex];
  const chapterStart = STORY.slice(0, chapterIndex).reduce((total, part) => total + part.text.length, 0);
  const chapterPosition = position - chapterStart;
  const expectedKey = TASK_TEXT[position] ?? "";
  const guide = KEY_GUIDES[expectedKey] ?? KEY_GUIDES[" "];
  const accuracy = Math.round((TASK_TEXT.length / (TASK_TEXT.length + errorCount)) * 1000) / 10;

  const persistSession = useCallback(() => {
    const current = sessionRef.current;
    if (!current) return;

    try {
      if (bookmarkRef.current && current.status === "active") {
        window.localStorage.setItem(BOOKMARK_KEY, JSON.stringify({ ...bookmarkRef.current, session: current }));
      } else {
        window.localStorage.removeItem(BOOKMARK_KEY);
      }
      const stored = readStorage();
      const existingIndex = stored.sessions.findIndex((session) => session.id === current.id);
      const nextSessions = [...stored.sessions];
      if (existingIndex >= 0) nextSessions[existingIndex] = current;
      else nextSessions.push(current);
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ version: 1, sessions: nextSessions.slice(-12) }),
      );
      setStorageAvailable(true);
      setLocalSummary(summarizeLocalData());
    } catch {
      setStorageAvailable(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      try {
        const raw = window.localStorage.getItem(BOOKMARK_KEY);
        const saved = parseBookmark(raw, TASK_VERSION, STORY.map((part) => part.text));
        if (saved) {
          const { session, ...bookmark } = saved;
          sessionRef.current = session;
          bookmarkRef.current = bookmark;
          hintKeysRef.current = new Set(session.hints.map((hint) => `${hint.position}-${hint.level}`));
          pauseKeysRef.current = new Set(session.pauses.map((pause) => pause.position));
          setChapterIndex(saved.chapterIndex);
          setPosition(saved.position);
          setErrorCount(session.errors.length);
          setPhase("resume");
        } else if (raw) {
          window.localStorage.removeItem(BOOKMARK_KEY);
        }
      } catch {
        setStorageAvailable(false);
      }
      setReady(true);
    });
    return () => { cancelled = true; };
  }, []);

  const addHint = useCallback(
    (level: number, reason: "pause" | "error", currentPosition = position) => {
      setHintLevel((current) => Math.max(current, level));
      const current = sessionRef.current;
      if (!current) return;

      for (let shownLevel = 1; shownLevel <= level; shownLevel += 1) {
        const hintKey = `${currentPosition}-${shownLevel}`;
        if (hintKeysRef.current.has(hintKey)) continue;
        hintKeysRef.current.add(hintKey);
        current.hints.push({
          position: currentPosition,
          expected: TASK_TEXT[currentPosition],
          level: shownLevel,
          reason,
        });
      }
      persistSession();
    },
    [persistSession, position],
  );

  useEffect(() => {
    if (phase !== "type" || dataOpen) return;

    const firstHintTimer = window.setTimeout(() => {
      const current = sessionRef.current;
      if (current && !pauseKeysRef.current.has(position)) {
        pauseKeysRef.current.add(position);
        current.pauses.push({ position, expected: TASK_TEXT[position], durationMs: 1200 });
      }
      addHint(1, "pause", position);
    }, 1200);
    const fingerHintTimer = window.setTimeout(() => addHint(2, "pause", position), 2800);
    const pathHintTimer = window.setTimeout(() => addHint(3, "pause", position), 4800);

    return () => {
      window.clearTimeout(firstHintTimer);
      window.clearTimeout(fingerHintTimer);
      window.clearTimeout(pathHintTimer);
    };
  }, [addHint, dataOpen, phase, position]);

  useEffect(() => {
    if (phase === "type") {
      practiceRef.current?.focus({ preventScroll: true });
      if (!window.matchMedia("(min-width: 48rem) and (min-height: 40rem)").matches) {
        practiceRef.current?.closest(".practice-panel")?.scrollIntoView({ block: "start" });
      }
    } else if ((phase === "read" && chapterIndex > 0) || phase === "done") {
      chapterButtonRef.current?.focus({ preventScroll: true });
      if (!window.matchMedia("(min-width: 48rem) and (min-height: 40rem)").matches) {
        chapterButtonRef.current?.closest(".practice-panel")?.scrollIntoView({ block: "start" });
      }
    }
  }, [chapterIndex, phase]);

  useEffect(() => {
    if (!dataOpen) return;
    const previousFocus = document.activeElement;
    const practice = practiceRef.current;
    const dialog = dialogRef.current;
    dialog?.querySelector<HTMLButtonElement>("button")?.focus();
    const trapFocus = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const buttons = dialog?.querySelectorAll<HTMLButtonElement>("button");
      if (!buttons?.length) return;
      const first = buttons[0];
      const last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first.focus();
      }
    };
    document.addEventListener("keydown", trapFocus);
    return () => {
      document.removeEventListener("keydown", trapFocus);
      if (practice) practice.focus();
      else if (previousFocus instanceof HTMLElement) previousFocus.focus();
    };
  }, [dataOpen]);

  const startMission = useCallback(() => {
    bookmarkRef.current = { version: 1, taskVersion: TASK_VERSION, chapterIndex, position, phase: "paused" };
    if (chapterIndex > 0) {
      persistSession();
      setHintLevel(0);
      setFeedback("Take your time. Find the first letter.");
      setPhase("type");
      return;
    }
    sessionRef.current = createSession();
    persistSession();
    hintKeysRef.current = new Set();
    pauseKeysRef.current = new Set();
    setPosition(0);
    setErrorCount(0);
    setHintLevel(0);
    setFeedback("Take your time. Find the first letter.");
    setPhase("type");
  }, [chapterIndex, persistSession, position]);

  const returnToBriefing = useCallback(() => {
    bookmarkRef.current = null;
    sessionRef.current = null;
    setPhase("read");
    setChapterIndex(0);
    setErrorCount(0);
    setPosition(0);
    setHintLevel(0);
    setFeedback("Take your time. Find the first letter.");
  }, []);

  const finishMission = useCallback(
    (finalErrorCount: number) => {
      const finalAccuracy = Math.round(
        (TASK_TEXT.length / (TASK_TEXT.length + finalErrorCount)) * 1000,
      ) / 10;
      if (sessionRef.current) {
        bookmarkRef.current = null;
        sessionRef.current.status = "complete";
        sessionRef.current.completedAt = new Date().toISOString();
        sessionRef.current.accuracy = finalAccuracy;
        persistSession();
      }
      setPhase("done");
      setFeedback(STORY[STORY.length - 1].reward);
    },
    [persistSession],
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === "Escape" && dataOpen) {
        setDataOpen(false);
        return;
      }
      if (dataOpen) return;
      if (phase !== "type" || event.metaKey || event.ctrlKey || event.altKey || event.repeat) {
        return;
      }
      if (event.target instanceof Element && event.target.closest("button, a, input, textarea, select")) return;
      if (["Shift", "CapsLock", "Tab", "Escape"].includes(event.key)) return;
      if (event.key.length !== 1 && event.key !== "Backspace") return;

      event.preventDefault();
      const received = event.key.length === 1 ? event.key.toLowerCase() : event.key;
      const isCorrect = received === expectedKey;

      if (!isCorrect) {
        const nextErrorCount = errorCount + 1;
        setErrorCount(nextErrorCount);
        setIsErrorFlash(true);
        window.setTimeout(() => setIsErrorFlash(false), 260);
        setFeedback(
          received === "Backspace"
            ? `No need to go back. Find ${keyLabel(expectedKey)} and try again.`
            : `Almost! Return to ${guide.home}, then find ${keyLabel(expectedKey)}.`,
        );
        if (sessionRef.current) {
          sessionRef.current.errors.push({
            position,
            expected: expectedKey,
            received: received === "Backspace" ? "backspace" : received.slice(0, 1),
          });
        }
        addHint(2, "error", position);
        persistSession();
        return;
      }

      const nextPosition = position + 1;
      if (nextPosition >= TASK_TEXT.length) {
        setPosition(nextPosition);
        finishMission(errorCount);
        return;
      }

      setPosition(nextPosition);
      const finishedPage = nextPosition === chapterStart + chapter.text.length;
      bookmarkRef.current = { version: 1, taskVersion: TASK_VERSION,
        chapterIndex: finishedPage ? chapterIndex + 1 : chapterIndex,
        position: nextPosition, phase: finishedPage ? "read" : "paused" };
      persistSession();
      if (nextPosition === chapterStart + chapter.text.length) {
        setChapterIndex((current) => current + 1);
        setPhase("read");
      }
      setHintLevel(0);
      setFeedback(errorCount > 0 ? "You found it! Keep going at your own pace." : "Nice work. Follow the starlight. ");
    },
    [addHint, chapterIndex, chapter.text.length, chapterStart, dataOpen, errorCount, expectedKey, finishMission, guide.home, persistSession, phase, position],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    const blockPaste = (event: ClipboardEvent) => {
      if (phase === "type" && !dataOpen) {
        event.preventDefault();
        setFeedback("Use the physical keyboard and find the path one key at a time.");
      }
    };
    window.addEventListener("paste", blockPaste);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("paste", blockPaste);
    };
  }, [dataOpen, handleKeyDown, phase]);

  const clearLocalData = useCallback(() => {
    try {
      window.localStorage.removeItem(BOOKMARK_KEY);
      window.localStorage.removeItem(STORAGE_KEY);
      setLocalSummary({ ...EMPTY_SUMMARY });
      returnToBriefing();
      setDataOpen(false);
      hintKeysRef.current = new Set();
      pauseKeysRef.current = new Set();
      setStorageAvailable(true);
    } catch {
      setStorageAvailable(false);
    }
  }, [returnToBriefing]);

  return (
    <main className={`site-shell phase-${phase}`}>
      <header className="topbar">
        <a className="brand" href="#mission" aria-label="Starpath Typing Lab home">
          <span className="brand-mark" aria-hidden="true">✦</span>
          <span>Starpath Typing Lab</span>
        </a>
        <button className="data-button" type="button" onClick={() => { setLocalSummary(summarizeLocalData()); setDataOpen(true); }}>
          <span className="status-dot" aria-hidden="true" />
          On-device data
        </button>
      </header>

      <section className="mission-layout" id="mission">
        <aside className="story-panel" aria-label="Mission briefing">
          <div className="eyebrow">MISSION 01 · MOONLIGHT VALLEY</div>
          <div className="fox-badge" aria-hidden="true">🦊</div>
          <p className="story-kicker">A little kindness lights the way</p>
          <h1>Help the little fox<br />find the way home</h1>
          <p className="story-copy">
            Follow a lost fox through the woods, meet helpful friends, and find home. Eight short pages, one happy ending.
          </p>
          <div className="calm-note">
            <span aria-hidden="true">☼</span>
            <p><strong>No need to race.</strong><br />Finding each key is the win.</p>
          </div>
          <ol className="story-steps" aria-label="Story progress">
            {STORY.map((part, index) => (
              <li key={part.title} className={phase === "done" || index < chapterIndex ? "finished" : index === chapterIndex ? "active" : ""} aria-current={phase !== "done" && index === chapterIndex ? "step" : undefined}>
                <span aria-hidden="true">{phase === "done" || index < chapterIndex ? "✓" : index + 1}</span>{part.title}
              </li>
            ))}
          </ol>
        </aside>

        <section className={`practice-panel ${isErrorFlash ? "error-flash" : ""}`}>
          <Journey chapterIndex={chapterIndex} fraction={chapterPosition / chapter.text.length} done={phase === "done"} />
          {!storageAvailable && <p className="save-warning" role="status">Your browser could not save your place. Keep this page open to continue.</p>}
          {phase === "resume" && (
            <div className="briefing-state resume-state">
              <div className="step-label">WELCOME BACK</div>
              <h2 className="chapter-title">Your fox is waiting!</h2>
              <p>Page {chapterIndex + 1} of {STORY.length} · {chapter.title}</p>
              <p>{chapterPosition} of {chapter.text.length} keys typed on this page.</p>
              <button className="primary-button" onClick={() => {
                setPhase(bookmarkRef.current?.phase === "read" ? "read" : "type");
                setFeedback("Welcome back. Let’s take the next step together.");
                        }}>Continue the story</button>
              <p className="keyboard-only-note">Your place and mistakes are remembered on this browser.</p>
            </div>
          )}
          {phase === "read" && (
            <div className="briefing-state">
              {chapterIndex > 0 && <p className="chapter-reward" role="status">✓ {STORY[chapterIndex - 1].reward}</p>}
              <div className="step-label"><span>{chapterIndex + 1}</span> PAGE {chapterIndex + 1} OF {STORY.length} · READ FIRST</div>
              <h2 className="chapter-title">{chapter.title}</h2>
              <p className="reading-passage">{chapter.text}</p>
              {chapterIndex === 0 && (
                <div className="home-setup">
                  <p>Rest each finger on its starting key.</p>
                  <HomeHands />
                  <p>Feel the bumps on F and J. Thumbs rest on space.</p>
                </div>
              )}
              <div className="read-checks" aria-label="Before you begin">
                <span>✓ Feet comfy</span>
                <span>✓ Index fingers on F and J</span>
                <span>✓ Read first, then type</span>
              </div>
              <button className="primary-button" type="button" ref={chapterButtonRef} disabled={!ready} onClick={startMission}>
                {chapterIndex === 0 ? "Start the story" : "Type this page"} <span aria-hidden="true">→</span>
              </button>
              <p className="keyboard-only-note">Use a physical English keyboard. Lowercase is fine. Rest between pages.</p>
            </div>
          )}

          {phase === "paused" && (
            <div className="briefing-state">
              <div className="step-label">TAKE A BREATHER</div>
              <h2 className="chapter-title">Your friends will wait.</h2>
              <p>Relax your hands. You are on page {chapterIndex + 1} of {STORY.length}.</p>
              <p>{storageAvailable ? "Your place is saved in this browser. You can close this page and come back." : "Keep this page open. Your browser could not save your place."}</p>
              <button className="primary-button" onClick={() => {
                setPhase("type");
                        }}>Keep going</button>
            </div>
          )}

          {phase === "type" && (
            <div
              className="typing-state"
              ref={practiceRef}
              tabIndex={0}
              role="textbox"
              aria-multiline="true"
              aria-label={`Typing mission. Type ${keyLabel(expectedKey)} next.`}
            >
              <div className="task-meta">
                <div className="step-label"><span>{chapterIndex + 1}</span> PAGE {chapterIndex + 1} OF {STORY.length}</div>
                <button className="pause-button" onClick={(event) => { event.stopPropagation(); setPhase("paused"); }}>Pause</button>
              </div>

              <div className="chapter-heading"><h2>{chapter.title}</h2><span>{chapterPosition} / {chapter.text.length} keys</span></div>
              <p className="typing-passage" aria-label={chapter.text}>
                {chapter.text.split(/(?<= )/).map((word, wordIndex, words) => {
                  const wordStart = words.slice(0, wordIndex).join("").length;
                  return (
                    <span className="typing-word" key={wordStart} aria-hidden="true">
                      {word.split("").map((character, characterIndex) => {
                        const index = wordStart + characterIndex;
                        const state = index < chapterPosition ? "complete" : index === chapterPosition ? "current" : "pending";
                        return (
                          <span key={index} className={`character ${state} ${character === " " ? "space-character" : ""}`}>
                            {character === " " ? "\u00A0" : character}
                          </span>
                        );
                      })}
                    </span>
                  );
                })}
              </p>

              <div className={`feedback-line ${isErrorFlash ? "is-error" : ""}`} role="status">
                <span className="feedback-icon" aria-hidden="true">{isErrorFlash ? "↺" : "✦"}</span>
                <span>{feedback}</span>
              </div>

              <div className="guide-grid">
                <section className="keyboard-card" aria-label="Keyboard hint">
                  <div className="guide-heading">
                    <span>KEYBOARD</span>
                    <strong>{hintLevel >= 1 ? `Find ${keyLabel(expectedKey)}` : "Green = starting keys"}</strong>
                  </div>
                  <div className="keyboard" aria-hidden="true">
                    {KEY_ROWS.map((row, rowIndex) => (
                      <div className={`key-row row-${rowIndex + 1}`} key={row.join("")}>
                        {row.map((key) => (
                          <span
                            className={`key ${hintLevel >= 1 && key === expectedKey ? "target-key" : ""} ${HOME_KEYS[key] ? "home-key" : ""} ${hintLevel >= 2 && key.toUpperCase() === guide.home ? "finger-start-key" : ""} ${key === "f" || key === "j" ? "bump-key" : ""}`}
                            key={key}
                            title={HOME_KEYS[key] ? `${HOME_KEYS[key]} starts here` : undefined}
                          >
                            {key.toUpperCase()}
                          </span>
                        ))}
                      </div>
                    ))}
                    <div className="key-row space-row">
                      <span className={`key space-key home-key ${hintLevel >= 1 && expectedKey === " " ? "target-key" : ""}`}>SPACE</span>
                    </div>
                  </div>
                </section>

                <section className="finger-card" aria-label="Finger hint">
                  <div className="guide-heading">
                    <span>STARTING KEYS</span>
                    <strong>{hintLevel >= 2 ? `${guide.side} · ${guide.finger}` : "F / J bumps · ␣ space"}</strong>
                  </div>
                  <HomeHands activeSide={hintLevel >= 2 ? guide.side : undefined} activeFinger={hintLevel >= 2 ? guide.finger : undefined} />
                  <div className={`movement-path ${hintLevel >= 3 ? "is-visible" : ""}`}>
                    {hintLevel >= 3 ? (
                      <>
                        <span className="path-key">{guide.home}</span>
                        <span className="path-arrow">→</span>
                        <span className="path-copy">{guide.move}</span>
                        <span className="path-arrow">→</span>
                        <span className="path-key target-path-key">{keyLabel(expectedKey)}</span>
                      </>
                    ) : (
                      <span className="path-placeholder">Pause for a moment to see the movement path</span>
                    )}
                  </div>
                </section>
              </div>
            </div>
          )}

          {phase === "done" && (
            <div className="done-state">
              <div className="signal-orbit" aria-hidden="true">
                <span>✦</span>
                <div>🦊</div>
              </div>
              <div className="step-label centered"><span>✓</span> STORY COMPLETE</div>
              <h2>Home, with new friends!</h2>
              <p className="chapter-reward">All {STORY.length} pages complete · {WORD_COUNT} words typed</p>
              <p>{feedback}</p>
              <div className="result-card">
                <span>YOUR ACCURACY</span>
                <strong>{accuracy}%</strong>
                <p>{accuracy >= 90 ? "You found nearly every trail marker." : "You stayed with the whole path. That matters."}</p>
              </div>
              <button className="secondary-button" type="button" ref={chapterButtonRef} onClick={returnToBriefing}>
                Read and play again
              </button>
              <p className="result-note">No rankings. A wrong key never stops the mission.</p>
            </div>
          )}
        </section>
      </section>

      <footer className="privacy-strip">
        <span><strong>Saved on this device only</strong> · No account · No upload</span>
        <span>Saves your place, mistakes, and hints — never the full correct key stream</span>
      </footer>

      {dataOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setDataOpen(false); }}>
          <div
            className="data-modal"
            ref={dialogRef}

            role="dialog"
            aria-modal="true"
            aria-labelledby="data-title"
          >
            <button className="close-button" type="button" aria-label="Close on-device data" onClick={() => setDataOpen(false)}>×</button>
            <div className="eyebrow">CLEAR, LOCAL RESEARCH DATA</div>
            <h2 id="data-title">What does this device remember?</h2>
            <p className="data-intro">
              Only enough to learn whether the hints make sense. No names, accounts, recordings, or network uploads.
            </p>
            <div className="data-stats">
              <div><strong>{localSummary.sessions}</strong><span>missions</span></div>
              <div><strong>{localSummary.errors}</strong><span>mistakes</span></div>
              <div><strong>{localSummary.pauses}</strong><span>pauses</span></div>
              <div><strong>{localSummary.hints}</strong><span>hints</span></div>
            </div>
            <ul className="data-list">
              <li><span>Saved</span>Your chapter and next key, wrong keys, pauses, and hints. Your saved place is cleared when you finish the story.</li>
              <li><span>Never saved</span>Names, the full correct key stream, speed rankings, or actual finger movement</li>
            </ul>
            {!storageAvailable && <p className="storage-warning">Your browser blocked local saving. You can still finish the mission.</p>}
            <button className="clear-button" type="button" onClick={clearLocalData}>Clear progress and data</button>
          </div>
        </div>
      )}
    </main>
  );
}
