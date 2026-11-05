"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const TASK_TEXT = "guide the red fox to the quiet hill.";
const STORAGE_KEY = "starpath-typing-research-v1";
const TASK_VERSION = "moon-fox-01";

const KEY_ROWS = [
  ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
  ["a", "s", "d", "f", "g", "h", "j", "k", "l"],
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

type TypingErrorLog = {
  position: number;
  expected: string;
  received: string;
};

type PauseLog = {
  position: number;
  expected: string;
  durationMs: number;
};

type HintLog = {
  position: number;
  expected: string;
  level: number;
  reason: "pause" | "error";
};

type StoredSession = {
  id: string;
  taskVersion: string;
  startedAt: string;
  completedAt?: string;
  status: "active" | "complete";
  accuracy?: number;
  errors: TypingErrorLog[];
  pauses: PauseLog[];
  hints: HintLog[];
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
    return parsed;
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
  const [phase, setPhase] = useState<"read" | "type" | "done">("read");
  const [position, setPosition] = useState(0);
  const [errorCount, setErrorCount] = useState(0);
  const [hintLevel, setHintLevel] = useState(0);
  const [feedback, setFeedback] = useState("Take your time. Find the first letter.");
  const [isErrorFlash, setIsErrorFlash] = useState(false);
  const [dataOpen, setDataOpen] = useState(false);
  const [localSummary, setLocalSummary] = useState<LocalSummary>(EMPTY_SUMMARY);
  const [storageAvailable, setStorageAvailable] = useState(true);
  const practiceRef = useRef<HTMLDivElement>(null);
  const sessionRef = useRef<StoredSession | null>(null);
  const hintKeysRef = useRef(new Set<string>());
  const pauseKeysRef = useRef(new Set<number>());

  const expectedKey = TASK_TEXT[position] ?? "";
  const guide = KEY_GUIDES[expectedKey] ?? KEY_GUIDES[" "];
  const accuracy = Math.round((TASK_TEXT.length / (TASK_TEXT.length + errorCount)) * 100);

  const persistSession = useCallback(() => {
    const current = sessionRef.current;
    if (!current) return;

    try {
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
    setLocalSummary(summarizeLocalData());
  }, []);

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

  const startMission = useCallback(() => {
    sessionRef.current = createSession();
    hintKeysRef.current = new Set();
    pauseKeysRef.current = new Set();
    setPosition(0);
    setErrorCount(0);
    setHintLevel(0);
    setFeedback("Take your time. Find the first letter.");
    setPhase("type");
    window.setTimeout(() => practiceRef.current?.focus(), 0);
  }, []);

  const returnToBriefing = useCallback(() => {
    setPhase("read");
    setPosition(0);
    setHintLevel(0);
    setFeedback("Take your time. Find the first letter.");
  }, []);

  const finishMission = useCallback(
    (finalErrorCount: number) => {
      const finalAccuracy = Math.round(
        (TASK_TEXT.length / (TASK_TEXT.length + finalErrorCount)) * 100,
      );
      if (sessionRef.current) {
        sessionRef.current.status = "complete";
        sessionRef.current.completedAt = new Date().toISOString();
        sessionRef.current.accuracy = finalAccuracy;
        persistSession();
      }
      setPhase("done");
      setFeedback("The signal made it! The little fox found the way home.");
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
      if (["Shift", "CapsLock", "Tab", "Escape"].includes(event.key)) return;

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
        finishMission(errorCount);
        return;
      }

      setPosition(nextPosition);
      setHintLevel(0);
      setFeedback(errorCount > 0 ? "You found it! Keep going at your own pace." : "Nice work. Follow the starlight. ");
    },
    [addHint, dataOpen, errorCount, expectedKey, finishMission, guide.home, persistSession, phase, position],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    const blockPaste = (event: ClipboardEvent) => {
      if (phase === "type") {
        event.preventDefault();
        setFeedback("Use the physical keyboard and find the path one key at a time.");
      }
    };
    window.addEventListener("paste", blockPaste);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("paste", blockPaste);
    };
  }, [handleKeyDown, phase]);

  const clearLocalData = useCallback(() => {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
      setLocalSummary({ ...EMPTY_SUMMARY });
      if (phase === "type") sessionRef.current = createSession();
      else sessionRef.current = null;
      hintKeysRef.current = new Set();
      pauseKeysRef.current = new Set();
      setStorageAvailable(true);
    } catch {
      setStorageAvailable(false);
    }
  }, [phase]);

  const progress = useMemo(
    () => Math.round((position / TASK_TEXT.length) * 100),
    [position],
  );

  return (
    <main className="site-shell">
      <header className="topbar">
        <a className="brand" href="#mission" aria-label="Starpath Typing Lab home">
          <span className="brand-mark" aria-hidden="true">✦</span>
          <span>Starpath Typing Lab</span>
        </a>
        <button className="data-button" type="button" onClick={() => setDataOpen(true)}>
          <span className="status-dot" aria-hidden="true" />
          On-device data
        </button>
      </header>

      <section className="mission-layout" id="mission">
        <aside className="story-panel" aria-label="Mission briefing">
          <div className="eyebrow">MISSION 01 · MOONLIGHT VALLEY</div>
          <div className="fox-badge" aria-hidden="true">🦊</div>
          <p className="story-kicker">A signal is waiting to be sent</p>
          <h1>Help the little fox<br />find the way home</h1>
          <p className="story-copy">
            It is hard to see in the dark. Type the signal carefully, and the hilltop light will shine.
          </p>
          <div className="calm-note">
            <span aria-hidden="true">☼</span>
            <p><strong>No need to race.</strong><br />Finding each key is the win.</p>
          </div>
        </aside>

        <section className={`practice-panel ${isErrorFlash ? "error-flash" : ""}`} aria-live="polite">
          {phase === "read" && (
            <div className="briefing-state">
              <div className="step-label"><span>1</span> READ THE SIGNAL</div>
              <p className="reading-passage">{TASK_TEXT}</p>
              <div className="read-checks" aria-label="Before you begin">
                <span>✓ Feet comfy</span>
                <span>✓ Index fingers on F and J</span>
                <span>✓ Read first, then type</span>
              </div>
              <button className="primary-button" type="button" onClick={startMission}>
                I&apos;m ready <span aria-hidden="true">→</span>
              </button>
              <p className="keyboard-only-note">Use a physical English keyboard for this mission</p>
            </div>
          )}

          {phase === "type" && (
            <div
              className="typing-state"
              ref={practiceRef}
              tabIndex={0}
              onClick={() => practiceRef.current?.focus()}
              aria-label={`Typing mission. Type ${keyLabel(expectedKey)} next.`}
            >
              <div className="task-meta">
                <div className="step-label"><span>2</span> TYPE THE SIGNAL</div>
                <div className="progress-copy">{position} / {TASK_TEXT.length}</div>
              </div>
              <div className="progress-track" aria-label={`Mission ${progress}% complete`}>
                <div className="progress-fill" style={{ width: `${progress}%` }} />
              </div>

              <p className="typing-passage" aria-label={TASK_TEXT}>
                {TASK_TEXT.split("").map((character, index) => {
                  const state = index < position ? "complete" : index === position ? "current" : "pending";
                  return (
                    <span
                      key={`${character}-${index}`}
                      className={`character ${state} ${character === " " ? "space-character" : ""}`}
                      aria-hidden="true"
                    >
                      {character === " " ? "\u00A0" : character}
                    </span>
                  );
                })}
              </p>

              <div className={`feedback-line ${isErrorFlash ? "is-error" : ""}`}>
                <span className="feedback-icon" aria-hidden="true">{isErrorFlash ? "↺" : "✦"}</span>
                <span>{feedback}</span>
              </div>

              <div className="guide-grid">
                <section className="keyboard-card" aria-label="Keyboard hint">
                  <div className="guide-heading">
                    <span>KEYBOARD</span>
                    <strong>{hintLevel >= 1 ? `Find ${keyLabel(expectedKey)}` : "Try on your own"}</strong>
                  </div>
                  <div className="keyboard" aria-hidden="true">
                    {KEY_ROWS.map((row, rowIndex) => (
                      <div className={`key-row row-${rowIndex + 1}`} key={row.join("")}>
                        {row.map((key) => (
                          <span
                            className={`key ${hintLevel >= 1 && key === expectedKey ? "target-key" : ""} ${hintLevel >= 3 && key.toUpperCase() === guide.home ? "home-key" : ""}`}
                            key={key}
                          >
                            {key.toUpperCase()}
                          </span>
                        ))}
                      </div>
                    ))}
                    <div className="key-row space-row">
                      <span className={`key space-key ${hintLevel >= 1 && expectedKey === " " ? "target-key" : ""}`}>SPACE</span>
                    </div>
                  </div>
                </section>

                <section className="finger-card" aria-label="Finger hint">
                  <div className="guide-heading">
                    <span>FINGER</span>
                    <strong>{hintLevel >= 2 ? `${guide.side} · ${guide.finger}` : "Keep your home position"}</strong>
                  </div>
                  <div className="hands" aria-hidden="true">
                    {["Left hand", "Right hand"].map((side) => (
                      <div className="hand" key={side}>
                        <span className="hand-name">{side}</span>
                        <div className="fingers">
                          {FINGERS.map((finger) => {
                            const active =
                              hintLevel >= 2 &&
                              (guide.side === side || guide.side === "Both hands") &&
                              guide.finger === finger;
                            return (
                              <span className={`finger ${active ? "active-finger" : ""}`} key={finger}>
                                {finger.slice(0, 1)}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
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
              <div className="step-label centered"><span>✓</span> SIGNAL DELIVERED</div>
              <h2>The hilltop light is on!</h2>
              <p>{feedback}</p>
              <div className="result-card">
                <span>YOUR ACCURACY</span>
                <strong>{accuracy}%</strong>
                <p>{accuracy >= 90 ? "You found nearly every trail marker." : "You stayed with the whole path. That matters."}</p>
              </div>
              <button className="secondary-button" type="button" onClick={returnToBriefing}>
                Try this path again
              </button>
              <p className="result-note">No rankings. A wrong key never stops the mission.</p>
            </div>
          )}
        </section>
      </section>

      <footer className="privacy-strip">
        <span><strong>Saved on this device only</strong> · No account · No upload</span>
        <span>Stores mistakes, pauses, and hints — never the full correct key stream</span>
      </footer>

      {dataOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setDataOpen(false)}>
          <section
            className="data-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="data-title"
            onMouseDown={(event) => event.stopPropagation()}
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
              <li><span>Saved</span>Which wrong key was pressed, where a pause happened, and which hint appeared</li>
              <li><span>Never saved</span>Names, the full correct key stream, speed rankings, or actual finger movement</li>
            </ul>
            {!storageAvailable && <p className="storage-warning">Your browser blocked local saving. You can still finish the mission.</p>}
            <button className="clear-button" type="button" onClick={clearLocalData}>Clear data from this device</button>
          </section>
        </div>
      )}
    </main>
  );
}
