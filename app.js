// Kazakh Flashcards PWA
// Tap to reveal English then Russian. Swipe left = "I know" (show less),
// swipe right = "don't know" (show more). Progress saved in localStorage.

(function () {
  "use strict";

  const STORAGE_KEY = "kazflash.progress.v1";
  const MAX_LEVEL = 8;      // higher level = better known = shown less often
  const KNOWN_LEVEL = 1;    // level >= this counts as "known" in the stats

  // --- progress store -------------------------------------------------
  // progress[id] = { level, seen }
  let progress = load();

  function load() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
    } catch (e) {
      return {};
    }
  }
  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
    } catch (e) { /* storage full / private mode */ }
  }
  function idOf(w) { return w.kz + "|" + w.en + "|" + w.pos; }
  function stateOf(w) {
    const id = idOf(w);
    if (!progress[id]) progress[id] = { level: 0, seen: 0 };
    return progress[id];
  }

  // selection weight: low level -> high weight -> shown more often
  function weightOf(w) {
    return 1 / Math.pow(2, stateOf(w).level);
  }

  // --- weighted random pick (avoid immediate repeat) ------------------
  let currentIndex = -1;

  function pickIndex() {
    let total = 0;
    for (let i = 0; i < WORDS.length; i++) {
      if (i === currentIndex && WORDS.length > 1) continue;
      total += weightOf(WORDS[i]);
    }
    let r = Math.random() * total;
    for (let i = 0; i < WORDS.length; i++) {
      if (i === currentIndex && WORDS.length > 1) continue;
      r -= weightOf(WORDS[i]);
      if (r <= 0) return i;
    }
    return Math.floor(Math.random() * WORDS.length);
  }

  // --- DOM ------------------------------------------------------------
  const card = document.getElementById("card");
  const elPos = document.getElementById("card-pos");
  const elKz = document.getElementById("card-kz");
  const elEn = document.getElementById("card-en");
  const elRu = document.getElementById("card-ru");
  const tapHint = document.getElementById("tap-hint");
  const stage = document.getElementById("stage");
  const hintKnow = document.querySelector(".hint-know");
  const hintDont = document.querySelector(".hint-dont");

  let reveal = 0; // 0 = kz only, 1 = +en, 2 = +ru

  function renderCard() {
    const w = WORDS[currentIndex];
    elPos.textContent = w.pos || "";
    elKz.textContent = w.kz;
    elEn.textContent = w.en;
    elRu.textContent = w.ru;
    setReveal(0);
  }

  function setReveal(n) {
    reveal = n;
    elEn.classList.toggle("show", n >= 1);
    elRu.classList.toggle("show", n >= 2);
    if (n === 0) tapHint.textContent = "tap for English";
    else if (n === 1) tapHint.textContent = "tap for Russian";
    else tapHint.textContent = "swipe ← know  /  don't know →";
  }

  function nextCard() {
    currentIndex = pickIndex();
    renderCard();
  }

  // --- stats ----------------------------------------------------------
  const statKnown = document.getElementById("stat-known");
  const statSeen = document.getElementById("stat-seen");
  const statTotal = document.getElementById("stat-total");

  function updateStats() {
    let known = 0, seen = 0;
    for (const id in progress) {
      if (progress[id].seen > 0) seen++;
      if (progress[id].level >= KNOWN_LEVEL) known++;
    }
    statKnown.textContent = known;
    statSeen.textContent = seen;
    statTotal.textContent = WORDS.length;
  }

  // --- answer handling ------------------------------------------------
  function answer(known) {
    const w = WORDS[currentIndex];
    const st = stateOf(w);
    st.seen++;
    if (known) st.level = Math.min(MAX_LEVEL, st.level + 1);
    else st.level = Math.max(0, st.level - 1);
    save();
    updateStats();
    animateOut(known ? -1 : 1);
  }

  function flash(known) {
    card.classList.remove("flash-know", "flash-dont");
    void card.offsetWidth; // restart animation
    card.classList.add(known ? "flash-know" : "flash-dont");
  }

  function animateOut(dir) {
    // dir: -1 left (know), +1 right (don't know)
    const x = dir * (window.innerWidth + 200);
    card.style.transition = "transform 0.28s ease, opacity 0.28s ease";
    card.style.transform = "translateX(" + x + "px) rotate(" + dir * 18 + "deg)";
    card.style.opacity = "0";
    setTimeout(() => {
      card.style.transition = "none";
      card.style.transform = "translateX(0) rotate(0)";
      card.style.opacity = "1";
      nextCard();
      requestAnimationFrame(() => { card.style.transition = ""; });
    }, 280);
  }

  // --- pointer / swipe + tap -----------------------------------------
  let startX = 0, startY = 0, dragging = false, moved = false;

  function onDown(e) {
    const p = point(e);
    startX = p.x; startY = p.y; dragging = true; moved = false;
    card.style.transition = "none";
  }
  function onMove(e) {
    if (!dragging) return;
    const p = point(e);
    const dx = p.x - startX;
    const dy = p.y - startY;
    if (Math.abs(dx) > 8 || Math.abs(dy) > 8) moved = true;
    card.style.transform = "translateX(" + dx + "px) rotate(" + dx / 25 + "deg)";
    const intensity = Math.min(1, Math.abs(dx) / 120);
    hintKnow.style.opacity = dx < -10 ? intensity : 0;
    hintDont.style.opacity = dx > 10 ? intensity : 0;
  }
  function onUp(e) {
    if (!dragging) return;
    dragging = false;
    const p = point(e);
    const dx = p.x - startX;
    const dy = p.y - startY;
    hintKnow.style.opacity = 0;
    hintDont.style.opacity = 0;
    card.style.transition = "transform 0.2s ease";

    const THRESH = 80;
    if (Math.abs(dx) > THRESH && Math.abs(dx) > Math.abs(dy)) {
      const known = dx < 0; // left = know
      flash(known);
      answer(known);
      return;
    }
    // snap back
    card.style.transform = "translateX(0) rotate(0)";
    // treat as tap if barely moved
    if (!moved) advanceReveal();
  }

  function advanceReveal() {
    if (reveal < 2) setReveal(reveal + 1);
  }

  function point(e) {
    if (e.changedTouches && e.changedTouches[0]) {
      return { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
    }
    return { x: e.clientX, y: e.clientY };
  }

  // Use pointer events when available, fall back to touch.
  if (window.PointerEvent) {
    card.addEventListener("pointerdown", onDown);
    card.addEventListener("pointermove", onMove);
    card.addEventListener("pointerup", onUp);
    card.addEventListener("pointercancel", () => { dragging = false; });
  } else {
    card.addEventListener("touchstart", onDown, { passive: true });
    card.addEventListener("touchmove", onMove, { passive: true });
    card.addEventListener("touchend", onUp);
    card.addEventListener("mousedown", onDown);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  // keyboard: space/enter reveal, arrows answer
  card.addEventListener("keydown", (e) => {
    if (e.key === " " || e.key === "Enter") { e.preventDefault(); advanceReveal(); }
    else if (e.key === "ArrowLeft") { flash(true); answer(true); }
    else if (e.key === "ArrowRight") { flash(false); answer(false); }
  });

  // buttons
  document.getElementById("btn-know").addEventListener("click", () => { flash(true); answer(true); });
  document.getElementById("btn-dont").addEventListener("click", () => { flash(false); answer(false); });

  document.getElementById("reset-btn").addEventListener("click", () => {
    if (confirm("Reset all progress?")) {
      progress = {};
      save();
      updateStats();
      nextCard();
    }
  });

  // --- boot -----------------------------------------------------------
  updateStats();
  nextCard();

  // service worker for offline use
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("service-worker.js").catch(() => {});
    });
  }
})();
