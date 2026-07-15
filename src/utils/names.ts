const ADJECTIVES = [
  "Cinephile",
  "Popcorn",
  "Blockbuster",
  "Indie",
  "Sci-Fi",
  "Retro",
  "Vintage",
  "Criterion",
  "IMDb",
  "Director",
  "Screenplay",
  "Noir",
  "Ghibli",
  "Cyberpunk",
  "Sundance",
  "Cannes",
  "Oscar",
  "Hollywood",
  "Silent-Era",
  "Technicolor",
];

const NOUNS = [
  "Enthusiast",
  "Critic",
  "Collector",
  "Devourer",
  "Guru",
  "Junkie",
  "Buff",
  "Historian",
  "Geek",
  "Connoisseur",
  "Director",
  "Viewer",
  "Producer",
  "CastingDirector",
  "Screenwriter",
  "Cinematographer",
  "Stuntman",
  "Projectionist",
  "Composer",
  "Watcher",
];

export function generateRandomAlias(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const num = Math.floor(Math.random() * 900) + 100;
  return `${adj} ${noun} #${num}`;
}

export function getOrCreateSessionId(): string {
  let sessionId = localStorage.getItem("cinevote_session_id");
  if (!sessionId) {
    sessionId = "sess_" + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
    localStorage.setItem("cinevote_session_id", sessionId);
  }
  return sessionId;
}

export function getOrCreateAlias(): string {
  let alias = localStorage.getItem("cinevote_alias");
  if (!alias) {
    alias = generateRandomAlias();
    localStorage.setItem("cinevote_alias", alias);
  }
  return alias;
}

export function saveAlias(alias: string) {
  localStorage.setItem("cinevote_alias", alias);
}
