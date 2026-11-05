const STAGES = [
  { name: "Into the woods", icon: "🌲", before: "Help your fox find a path.", after: "A little light is up ahead." },
  { name: "Follow the firefly", icon: "✨", before: "Your new friend lights the trail.", after: "The stream is getting closer." },
  { name: "Cross the stream", icon: "🐸", before: "One careful step onto the stones.", after: "Almost across. The frog is cheering!" },
  { name: "Help the mouse", icon: "🐭", before: "A little mouse needs your help.", after: "Lift the twig. Your new friend is free!" },
  { name: "Climb the hill", icon: "🍃", before: "Stay close as the wind picks up.", after: "The light went out. Call your friends!" },
  { name: "Light the way", icon: "🌟", before: "The fireflies heard your call.", after: "Together, your friends light the hill!" },
  { name: "Home in sight", icon: "🏡", before: "Can you see the warm doorway?", after: "Your family is waiting just ahead." },
  { name: "Home together", icon: "💛", before: "Bring your new friends home.", after: "There is a place for everyone." },
];

export function Journey({ chapterIndex, fraction, done }: { chapterIndex: number; fraction: number; done: boolean }) {
  const part = Math.min(1, Math.max(0, fraction));
  const progress = done ? 1 : (chapterIndex + part) / STAGES.length;
  const stage = STAGES[chapterIndex];
  const mouseRescued = chapterIndex > 3 || (chapterIndex === 3 && part >= 0.5);
  const fireflyVisible = (chapterIndex >= 1 && chapterIndex <= 3) || (chapterIndex === 4 && part < 0.5) || chapterIndex >= 5;
  const cast = done ? "The fox celebrates with family, the frog, the mouse, and the fireflies." : chapterIndex === 2 ? "A frog waits by the stepping stones and shows the fox the way." :
    chapterIndex === 3 ? (mouseRescued ? "The rescued mouse follows the fox." : "A mouse is waiting under a twig for help.") :
    chapterIndex >= 6 ? "The fox family waits at the den." : fireflyVisible ? "A firefly lights the path." : "The fox explores the woods.";
  const caption = done ? "Home at last! You brought everyone together." : part < 0.5 ? stage.before : stage.after;
  return (
    <section className={`journey chapter-${chapterIndex} ${done ? "journey-complete" : ""}`} aria-label="Fox journey">
      <div className="journey-scene" role="img" aria-label={`Fox journey: ${done ? "home with friends" : stage.name}. ${Math.round(progress * 100)}% of the trail explored. ${cast}`}>
        <div className="journey-light" aria-hidden="true" />
        <span className="journey-location" aria-hidden="true">{stage.icon} {done ? "Everyone is home" : stage.name}</span>
        {chapterIndex === 2 && (
          <span className="story-character stream-frog" aria-hidden="true">
            <span className="character-speech">This way!</span>
            <span className="scene-animal">🐸</span>
          </span>
        )}
        {chapterIndex === 3 && !mouseRescued && (
          <span className="story-character waiting-mouse" aria-hidden="true">
            <span className="character-speech">Help me!</span>
            <span className="scene-animal">🐭<span className="mouse-twig">🌿</span></span>
          </span>
        )}
        {chapterIndex >= 6 && !done && <span className="story-character waiting-family" aria-hidden="true"><span className="character-speech">Welcome home!</span><span className="scene-family">🦊 🦊</span></span>}
        {chapterIndex === 5 && part >= 0.5 && <span className="firefly-friends" aria-hidden="true">✨ ✨ ✨</span>}
        <span className="journey-fox" aria-hidden="true" style={{ left: `${5 + progress * 87}%` }}>
          {mouseRescued && <span className="fox-friend">🐭</span>}
          <span className="fox-avatar" key={`${chapterIndex}-${Math.floor(part * 10)}`}>🦊</span>
          {fireflyVisible && <span className="fox-lights">✨</span>}
        </span>
        {done && <span className="home-party" aria-hidden="true">🐸 🦊 🦊 💛</span>}
      </div>
      <div className="journey-caption"><span>{caption}</span><span>{done ? "8 / 8" : `${chapterIndex} / 8`} stops complete</span></div>
      <div className="journey-stops" aria-label="Journey stops">
        {STAGES.map((stop, index) => <span key={stop.name} className={done || index < chapterIndex ? "reached" : index === chapterIndex ? "here" : ""} title={stop.name} aria-label={`${stop.name}: ${done || index < chapterIndex ? "complete" : index === chapterIndex ? "current" : "ahead"}`}>{done || index < chapterIndex ? "✓" : index + 1}</span>)}
      </div>
    </section>
  );
}
