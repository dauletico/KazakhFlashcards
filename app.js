// Kazakh Flashcards PWA
// Features: gradual word intro (frequency order), spaced repetition with due
// dates, mixed recall direction, daily goal + streak, and editable cards.
// All state is stored locally in the browser.

(function () {
  "use strict";

  const KEY = "kazflash.state.v2";

  const DAILY_GOAL = 20;     // reviews per day to hit the goal / keep streak
  const NEW_PER_DAY = 8;     // max brand-new words introduced per day
  const START_EASE = 2.5, MIN_EASE = 1.3, MAX_EASE = 3.0;
  const DAY_MS = 86400000;
  const LAPSE_MS = 30 * 1000; // a missed card comes back ~30s later (same session)

  // --- date helpers ---------------------------------------------------
  function todayNum() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return Math.round(d.getTime() / DAY_MS);
  }

  // --- state ----------------------------------------------------------
  // cards[i] = { reps, lapses, ease, interval(days), due(ms) }
  // edits[i] = { kz, en, ru, pos }  (overrides for the static word list)
  function freshState() {
    return {
      cards: {}, edits: {}, nextNew: 0,
      day: todayNum(), reviewedToday: 0, newToday: 0,
      streak: 0, lastGoalDay: -1
    };
  }
  function load() {
    try {
      const s = JSON.parse(localStorage.getItem(KEY));
      if (s && s.cards) {
        if (!s.edits) s.edits = {};
        return s;
      }
    } catch (e) {}
    return freshState();
  }
  let state = load();
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
  }

  // word with any user edits applied
  function wordOf(i) {
    const w = WORDS[i];
    const e = state.edits[i];
    return e ? { kz: e.kz, en: e.en, ru: e.ru, pos: e.pos } : w;
  }

  // --- day rollover & streak ------------------------------------------
  function refreshDay() {
    const t = todayNum();
    if (state.day !== t) {
      state.day = t;
      state.reviewedToday = 0;
      state.newToday = 0;
    }
    // streak is broken if the last completed day is older than yesterday
    if (state.lastGoalDay >= 0 && state.lastGoalDay < t - 1) state.streak = 0;
    save();
  }

  function checkGoal() {
    const t = todayNum();
    if (state.reviewedToday >= DAILY_GOAL && state.lastGoalDay !== t) {
      state.streak = (state.lastGoalDay === t - 1) ? state.streak + 1 : 1;
      state.lastGoalDay = t;
    }
  }

  // --- card selection -------------------------------------------------
  let currentI = -1, lastI = -1, currentDir = "recognition", stage = 0;

  function dueCards(now) {
    const out = [];
    for (const k in state.cards) {
      if (state.cards[k].due <= now) out.push(parseInt(k, 10));
    }
    return out;
  }

  function introduceNext(now) {
    if (state.nextNew >= WORDS.length) return -1;
    const i = state.nextNew;
    state.cards[i] = { reps: 0, lapses: 0, ease: START_EASE, interval: 0, due: now };
    state.nextNew++;
    state.newToday++;
    save();
    return i;
  }

  // pick the next card index, or -1 if caught up (unless ahead=true)
  function pickIndex(ahead) {
    const now = Date.now();
    let due = dueCards(now);
    if (due.length > 1) due = due.filter((i) => i !== lastI);
    if (due.length) {
      due.sort((a, b) => state.cards[a].due - state.cards[b].due); // most overdue first
      return due[0];
    }
    if ((ahead || state.newToday < NEW_PER_DAY) && state.nextNew < WORDS.length) {
      return introduceNext(now);
    }
    if (ahead) {
      // nothing due and no new words: pull the soonest-scheduled card
      let best = -1, bestDue = Infinity;
      for (const k in state.cards) {
        if (state.cards[k].due < bestDue) { bestDue = state.cards[k].due; best = parseInt(k, 10); }
      }
      return best;
    }
    return -1;
  }

  function chooseDir(i) {
    const c = state.cards[i];
    return (c && c.reps >= 2 && Math.random() < 0.4) ? "production" : "recognition";
  }

  // --- grading (spaced repetition) ------------------------------------
  function grade(known) {
    if (currentI < 0) return;
    const c = state.cards[currentI];
    const now = Date.now();
    if (known) {
      c.reps++;
      if (c.reps === 1) c.interval = 1;
      else if (c.reps === 2) c.interval = 3;
      else c.interval = Math.max(1, Math.round(c.interval * c.ease));
      c.ease = Math.min(MAX_EASE, c.ease + 0.05);
      c.due = now + c.interval * DAY_MS;
    } else {
      c.reps = 0;
      c.lapses++;
      c.interval = 0;
      c.ease = Math.max(MIN_EASE, c.ease - 0.2);
      c.due = now + LAPSE_MS;
    }
    state.reviewedToday++;
    checkGoal();
    save();
    updateStats();
    animateOut(known ? -1 : 1);
  }

  // --- DOM ------------------------------------------------------------
  const card = document.getElementById("card");
  const content = document.getElementById("card-content");
  const elPos = document.getElementById("card-pos");
  const elKz = document.getElementById("card-kz");
  const elEn = document.getElementById("card-en");
  const elRu = document.getElementById("card-ru");
  const tapHint = document.getElementById("tap-hint");
  const dirBadge = document.getElementById("dir-badge");
  const newBadge = document.getElementById("new-badge");
  const hintKnow = document.querySelector(".hint-know");
  const hintDont = document.querySelector(".hint-dont");
  const donePanel = document.getElementById("done");

  const els = { kz: elKz, en: elEn, ru: elRu };
  const REVEAL = {
    recognition: { cue: ["kz"], steps: ["en", "ru"] },
    production: { cue: ["en", "ru"], steps: ["kz"] }
  };
  const LABEL = { kz: "Kazakh", en: "English", ru: "Russian" };

  function showCard() {
    const i = pickIndex(false);
    if (i < 0) { showDone(); return; }
    currentI = i;
    lastI = i;
    currentDir = chooseDir(i);
    renderCard();
  }

  function renderCard() {
    donePanel.classList.add("hidden");
    card.style.display = "";
    const w = wordOf(currentI);
    const c = state.cards[currentI];
    elPos.textContent = w.pos || "";
    elKz.textContent = w.kz;
    elEn.textContent = w.en;
    elRu.textContent = w.ru;

    content.classList.toggle("flip", currentDir === "production");
    dirBadge.textContent = currentDir === "production" ? "Say it in Kazakh" : "What does it mean?";
    newBadge.classList.toggle("show", c.reps === 0 && c.lapses === 0);

    // hide everything, then reveal the cue side
    for (const k in els) els[k].classList.add("hide");
    REVEAL[currentDir].cue.forEach((k) => els[k].classList.remove("hide"));
    stage = 0;
    updateHint();
  }

  function updateHint() {
    const cfg = REVEAL[currentDir];
    if (stage < cfg.steps.length) {
      tapHint.textContent = "tap for " + LABEL[cfg.steps[stage]];
    } else {
      tapHint.textContent = "← know       don't know →";
    }
  }

  function revealNext() {
    const cfg = REVEAL[currentDir];
    if (stage < cfg.steps.length) {
      els[cfg.steps[stage]].classList.remove("hide");
      stage++;
      updateHint();
    }
  }

  function showDone() {
    currentI = -1;
    card.style.display = "none";
    donePanel.classList.remove("hidden");
  }

  // --- stats ----------------------------------------------------------
  const statStreak = document.getElementById("stat-streak");
  const statDue = document.getElementById("stat-due");
  const statGoal = document.getElementById("stat-goal");
  const statLearned = document.getElementById("stat-learned");
  const goalFill = document.getElementById("goalbar-fill");

  function updateStats() {
    const now = Date.now();
    let learned = 0;
    for (const k in state.cards) if (state.cards[k].reps >= 1) learned++;
    statStreak.textContent = state.streak;
    statDue.textContent = dueCards(now).length;
    statGoal.textContent = Math.min(state.reviewedToday, DAILY_GOAL) + "/" + DAILY_GOAL;
    statLearned.textContent = learned;
    goalFill.style.width = Math.min(100, (state.reviewedToday / DAILY_GOAL) * 100) + "%";
  }

  // --- animation ------------------------------------------------------
  function flash(known) {
    card.classList.remove("flash-know", "flash-dont");
    void card.offsetWidth;
    card.classList.add(known ? "flash-know" : "flash-dont");
  }
  function animateOut(dir) {
    const x = dir * (window.innerWidth + 200);
    card.style.transition = "transform 0.28s ease, opacity 0.28s ease";
    card.style.transform = "translateX(" + x + "px) rotate(" + dir * 18 + "deg)";
    card.style.opacity = "0";
    setTimeout(() => {
      card.style.transition = "none";
      card.style.transform = "translateX(0) rotate(0)";
      card.style.opacity = "1";
      showCard();
      requestAnimationFrame(() => { card.style.transition = ""; });
    }, 280);
  }

  // --- pointer / swipe + tap -----------------------------------------
  let startX = 0, startY = 0, dragging = false, moved = false;

  function point(e) {
    if (e.changedTouches && e.changedTouches[0]) {
      return { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
    }
    return { x: e.clientX, y: e.clientY };
  }
  function onDown(e) {
    if (currentI < 0) return;
    const p = point(e);
    startX = p.x; startY = p.y; dragging = true; moved = false;
    card.style.transition = "none";
  }
  function onMove(e) {
    if (!dragging) return;
    const p = point(e);
    const dx = p.x - startX, dy = p.y - startY;
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
    const dx = p.x - startX, dy = p.y - startY;
    hintKnow.style.opacity = 0;
    hintDont.style.opacity = 0;
    card.style.transition = "transform 0.2s ease";

    if (Math.abs(dx) > 80 && Math.abs(dx) > Math.abs(dy)) {
      const known = dx < 0; // left = know
      flash(known);
      grade(known);
      return;
    }
    card.style.transform = "translateX(0) rotate(0)";
    if (!moved) revealNext();
  }

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

  card.addEventListener("keydown", (e) => {
    if (e.key === " " || e.key === "Enter") { e.preventDefault(); revealNext(); }
    else if (e.key === "ArrowLeft") { flash(true); grade(true); }
    else if (e.key === "ArrowRight") { flash(false); grade(false); }
  });

  document.getElementById("btn-know").addEventListener("click", () => { if (currentI >= 0) { flash(true); grade(true); } });
  document.getElementById("btn-dont").addEventListener("click", () => { if (currentI >= 0) { flash(false); grade(false); } });
  document.getElementById("ahead-btn").addEventListener("click", () => {
    const i = pickIndex(true);
    if (i < 0) return;
    currentI = i; lastI = i; currentDir = chooseDir(i);
    renderCard();
  });

  document.getElementById("reset-btn").addEventListener("click", () => {
    if (confirm("Reset all progress? (Your card edits are kept.)")) {
      const edits = state.edits;
      state = freshState();
      state.edits = edits;
      save();
      updateStats();
      showCard();
    }
  });

  // --- edit modal -----------------------------------------------------
  const modal = document.getElementById("edit-modal");
  const inKz = document.getElementById("edit-kz");
  const inEn = document.getElementById("edit-en");
  const inRu = document.getElementById("edit-ru");
  const inPos = document.getElementById("edit-pos");

  function openEdit() {
    if (currentI < 0) return;
    const w = wordOf(currentI);
    inKz.value = w.kz; inEn.value = w.en; inRu.value = w.ru; inPos.value = w.pos || "";
    modal.classList.remove("hidden");
    inKz.focus();
  }
  function closeEdit() { modal.classList.add("hidden"); }

  document.getElementById("edit-btn").addEventListener("click", (e) => {
    e.stopPropagation();
    openEdit();
  });
  // keep taps on the edit button from bubbling into the card's pointer logic
  document.getElementById("edit-btn").addEventListener("pointerdown", (e) => e.stopPropagation());

  document.getElementById("edit-cancel").addEventListener("click", closeEdit);
  modal.addEventListener("click", (e) => { if (e.target === modal) closeEdit(); });

  document.getElementById("edit-save").addEventListener("click", () => {
    const kz = inKz.value.trim(), en = inEn.value.trim(), ru = inRu.value.trim(), pos = inPos.value.trim();
    if (!kz) { inKz.focus(); return; }
    const orig = WORDS[currentI];
    if (kz === orig.kz && en === orig.en && ru === orig.ru && pos === orig.pos) {
      delete state.edits[currentI]; // matches original -> no override needed
    } else {
      state.edits[currentI] = { kz, en, ru, pos };
    }
    save();
    closeEdit();
    renderCard();
  });

  document.getElementById("edit-reset").addEventListener("click", () => {
    const orig = WORDS[currentI];
    inKz.value = orig.kz; inEn.value = orig.en; inRu.value = orig.ru; inPos.value = orig.pos || "";
  });

  // --- boot -----------------------------------------------------------
  refreshDay();
  updateStats();
  showCard();

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("service-worker.js").catch(() => {});
    });
  }
})();
