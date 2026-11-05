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

type FingerSide = "左手" | "右手" | "双手";
type FingerName = "小指" | "无名指" | "中指" | "食指" | "拇指";

type KeyGuide = {
  side: FingerSide;
  finger: FingerName;
  home: string;
  move: string;
};

const KEY_GUIDES: Record<string, KeyGuide> = {
  q: { side: "左手", finger: "小指", home: "A", move: "从 A 向左上方" },
  a: { side: "左手", finger: "小指", home: "A", move: "留在 A" },
  z: { side: "左手", finger: "小指", home: "A", move: "从 A 向右下方" },
  w: { side: "左手", finger: "无名指", home: "S", move: "从 S 向左上方" },
  s: { side: "左手", finger: "无名指", home: "S", move: "留在 S" },
  x: { side: "左手", finger: "无名指", home: "S", move: "从 S 向右下方" },
  e: { side: "左手", finger: "中指", home: "D", move: "从 D 向左上方" },
  d: { side: "左手", finger: "中指", home: "D", move: "留在 D" },
  c: { side: "左手", finger: "中指", home: "D", move: "从 D 向右下方" },
  r: { side: "左手", finger: "食指", home: "F", move: "从 F 向左上方" },
  f: { side: "左手", finger: "食指", home: "F", move: "留在 F" },
  v: { side: "左手", finger: "食指", home: "F", move: "从 F 向右下方" },
  t: { side: "左手", finger: "食指", home: "F", move: "从 F 向右上方" },
  g: { side: "左手", finger: "食指", home: "F", move: "从 F 向右移动" },
  b: { side: "左手", finger: "食指", home: "F", move: "从 F 向右下方" },
  y: { side: "右手", finger: "食指", home: "J", move: "从 J 向左上方" },
  h: { side: "右手", finger: "食指", home: "J", move: "从 J 向左移动" },
  n: { side: "右手", finger: "食指", home: "J", move: "从 J 向左下方" },
  u: { side: "右手", finger: "食指", home: "J", move: "从 J 向右上方" },
  j: { side: "右手", finger: "食指", home: "J", move: "留在 J" },
  m: { side: "右手", finger: "食指", home: "J", move: "从 J 向左下方" },
  i: { side: "右手", finger: "中指", home: "K", move: "从 K 向右上方" },
  k: { side: "右手", finger: "中指", home: "K", move: "留在 K" },
  ",": { side: "右手", finger: "中指", home: "K", move: "从 K 向左下方" },
  o: { side: "右手", finger: "无名指", home: "L", move: "从 L 向右上方" },
  l: { side: "右手", finger: "无名指", home: "L", move: "留在 L" },
  ".": { side: "右手", finger: "无名指", home: "L", move: "从 L 向左下方" },
  p: { side: "右手", finger: "小指", home: ";", move: "从 ; 向右上方" },
  " ": { side: "双手", finger: "拇指", home: "空格", move: "拇指轻轻向下" },
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

const FINGERS: FingerName[] = ["小指", "无名指", "中指", "食指", "拇指"];

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
  return key === " " ? "空格" : key.toUpperCase();
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
  const [feedback, setFeedback] = useState("慢慢来，先找到第一个字母。");
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
    setFeedback("慢慢来，先找到第一个字母。");
    setPhase("type");
    window.setTimeout(() => practiceRef.current?.focus(), 0);
  }, []);

  const returnToBriefing = useCallback(() => {
    setPhase("read");
    setPosition(0);
    setHintLevel(0);
    setFeedback("慢慢来，先找到第一个字母。");
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
      setFeedback("信号送到了！小狐狸找到回家的路了。");
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
            ? `不用倒退，找到 ${keyLabel(expectedKey)} 再试一次。`
            : `差一点。手指回到 ${guide.home}，再找 ${keyLabel(expectedKey)}。`,
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
      setFeedback(errorCount > 0 ? "找到了！继续按自己的节奏来。" : "很好，继续沿着星光走。 ");
    },
    [addHint, dataOpen, errorCount, expectedKey, finishMission, guide.home, persistSession, phase, position],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    const blockPaste = (event: ClipboardEvent) => {
      if (phase === "type") {
        event.preventDefault();
        setFeedback("这次要用实体键盘，一个键一个键找到路线哦。");
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
        <a className="brand" href="#mission" aria-label="星路打字实验室首页">
          <span className="brand-mark" aria-hidden="true">✦</span>
          <span>星路打字实验室</span>
        </a>
        <button className="data-button" type="button" onClick={() => setDataOpen(true)}>
          <span className="status-dot" aria-hidden="true" />
          本机记录
        </button>
      </header>

      <section className="mission-layout" id="mission">
        <aside className="story-panel" aria-label="任务简报">
          <div className="eyebrow">任务 01 · 月光山谷</div>
          <div className="fox-badge" aria-hidden="true">🦊</div>
          <p className="story-kicker">一条信号正在等待发送</p>
          <h1>帮小狐狸<br />找到回家的路</h1>
          <p className="story-copy">
            夜色里看不清路。把这句英文信号准确地输入，山顶的灯就会亮起来。
          </p>
          <div className="calm-note">
            <span aria-hidden="true">☼</span>
            <p><strong>不用比速度。</strong><br />找准每一个键，就已经做得很好。</p>
          </div>
        </aside>

        <section className={`practice-panel ${isErrorFlash ? "error-flash" : ""}`} aria-live="polite">
          {phase === "read" && (
            <div className="briefing-state">
              <div className="step-label"><span>1</span> 先读一遍信号</div>
              <p className="reading-passage">{TASK_TEXT}</p>
              <div className="read-checks" aria-label="开始前准备">
                <span>✓ 双脚放稳</span>
                <span>✓ 食指轻放 F 和 J</span>
                <span>✓ 看完再开始</span>
              </div>
              <button className="primary-button" type="button" onClick={startMission}>
                我准备好了 <span aria-hidden="true">→</span>
              </button>
              <p className="keyboard-only-note">请使用电脑的实体英文键盘完成任务</p>
            </div>
          )}

          {phase === "type" && (
            <div
              className="typing-state"
              ref={practiceRef}
              tabIndex={0}
              onClick={() => practiceRef.current?.focus()}
              aria-label={`打字任务。当前需要输入 ${keyLabel(expectedKey)}`}
            >
              <div className="task-meta">
                <div className="step-label"><span>2</span> 输入信号</div>
                <div className="progress-copy">{position} / {TASK_TEXT.length}</div>
              </div>
              <div className="progress-track" aria-label={`任务完成 ${progress}%`}>
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
                <section className="keyboard-card" aria-label="键盘提示">
                  <div className="guide-heading">
                    <span>键盘</span>
                    <strong>{hintLevel >= 1 ? `找 ${keyLabel(expectedKey)}` : "先自己找一找"}</strong>
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
                      <span className={`key space-key ${hintLevel >= 1 && expectedKey === " " ? "target-key" : ""}`}>空格</span>
                    </div>
                  </div>
                </section>

                <section className="finger-card" aria-label="手指提示">
                  <div className="guide-heading">
                    <span>手指</span>
                    <strong>{hintLevel >= 2 ? `${guide.side}${guide.finger}` : "保持手位"}</strong>
                  </div>
                  <div className="hands" aria-hidden="true">
                    {["左手", "右手"].map((side) => (
                      <div className="hand" key={side}>
                        <span className="hand-name">{side}</span>
                        <div className="fingers">
                          {FINGERS.map((finger) => {
                            const active =
                              hintLevel >= 2 &&
                              (guide.side === side || guide.side === "双手") &&
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
                      <span className="path-placeholder">停一下，移动路线就会出现</span>
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
              <div className="step-label centered"><span>✓</span> 信号已送达</div>
              <h2>山顶的灯亮了！</h2>
              <p>{feedback}</p>
              <div className="result-card">
                <span>这次准确率</span>
                <strong>{accuracy}%</strong>
                <p>{accuracy >= 90 ? "你把大多数路标都找对了。" : "你坚持找完了整条路线，这很重要。"}</p>
              </div>
              <button className="secondary-button" type="button" onClick={returnToBriefing}>
                再走一次这条路
              </button>
              <p className="result-note">这里不排名，也不会因为错键挡住任务完成。</p>
            </div>
          )}
        </section>
      </section>

      <footer className="privacy-strip">
        <span><strong>仅保存在这台设备</strong> · 不登录 · 不联网 · 不上传</span>
        <span>只记错键、停顿与提示使用，不记录完整正确输入</span>
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
            <button className="close-button" type="button" aria-label="关闭本机记录" onClick={() => setDataOpen(false)}>×</button>
            <div className="eyebrow">透明的本地记录</div>
            <h2 id="data-title">这台设备记住了什么？</h2>
            <p className="data-intro">
              只用来观察提示是否容易理解。没有姓名、账号、录音，也不会发送到网络。
            </p>
            <div className="data-stats">
              <div><strong>{localSummary.sessions}</strong><span>次完成</span></div>
              <div><strong>{localSummary.errors}</strong><span>个错键</span></div>
              <div><strong>{localSummary.pauses}</strong><span>次停顿</span></div>
              <div><strong>{localSummary.hints}</strong><span>次提示</span></div>
            </div>
            <ul className="data-list">
              <li><span>会保存</span>错按了哪个键、在哪一步停顿、出现了哪一级提示</li>
              <li><span>不会保存</span>姓名、完整正确击键流、速度排名或真实手指动作</li>
            </ul>
            {!storageAvailable && <p className="storage-warning">浏览器阻止了本地保存，本次任务仍可继续。</p>}
            <button className="clear-button" type="button" onClick={clearLocalData}>清除这台设备上的记录</button>
          </section>
        </div>
      )}
    </main>
  );
}
