# Kazakh Flashcards

A lightweight, installable **Progressive Web App** for learning the most common
Kazakh words, with English and Russian translations. Built with plain HTML, CSS,
and JavaScript — no build step, no dependencies. All progress is stored locally
in your browser.

## ▶️ Live app

**https://dauletico.github.io/KazakhFlashcards/**

Open it on your phone and tap **Add to Home Screen** to install it like a native
app — it works offline.

## Features

- **Flashcards** with spaced repetition (SM-2-style scheduling, due dates, and
  ease adjustment).
- **Mixed recall direction** — recognition (Kazakh → meaning) and production
  (meaning → Kazakh) once a word is established.
- **Knowledge check** — a multiple-choice quiz over words you've already learned.
  Pick the correct meaning from four mixed options; **a wrong answer sends the
  word back into flashcard mode** for more review.
- **Gradual introduction** of new words in frequency order (a few new words per
  day).
- **Daily goal & streak** tracking.
- **Editable cards** — fix or tweak any translation inline.
- **Offline-first PWA** — installable, works without a connection.

## How it works

| Mode | What you do |
| --- | --- |
| **Flashcards** | Tap the card to reveal the meaning, then swipe left (*I know*) or right (*don't know*). Knowing a word schedules it further out; missing it brings it back soon. |
| **Knowledge check** | A learned Kazakh word is shown with four possible meanings. Choose the right one. Correct answers move on; incorrect answers reset the word and return it to the flashcard rotation. |

Use the **Flashcards / Knowledge check** switcher at the top to change modes.
Progress (and any card edits) live in your browser's `localStorage`, so it stays
on your device.

## Running locally

It's all static files — serve the folder with any static server:

```bash
# Python
python -m http.server 8000

# or Node
npx serve .
```

Then open <http://localhost:8000>. (A server is recommended over opening
`index.html` directly so the service worker and PWA features work.)

## Project structure

```
index.html          App shell and markup
styles.css          Styling
app.js              Spaced repetition, quiz logic, and UI behavior
words.js            The word list (auto-generated from the CSV source)
manifest.json       PWA manifest
service-worker.js   Offline caching
icons/              App icon
```

## Enabling GitHub Pages (maintainers)

The live link above is served from GitHub Pages. To (re)enable it:

1. Go to **Settings → Pages** in the repository.
2. Under **Build and deployment → Source**, choose **Deploy from a branch**.
3. Select branch **`main`** and folder **`/ (root)`**, then **Save**.
4. After a minute, the site is published at the URL above.

## License

See [LICENSE](LICENSE).
