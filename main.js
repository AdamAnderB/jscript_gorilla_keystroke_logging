<script>
/* ====== Config ====== */
const PAUSE_THRESHOLD_MS = 2000;   // define "pause" as >= 2s of no input
const GAZE_SAMPLE_EVERY_MS = 100;  // gaze polling interval
const GAZE_MIN_DWELL_MS = 120;     // only log gaze states that last this long

/* ====== Helpers ====== */
function now() { return performance && performance.now ? performance.now() : Date.now(); }

/** Fast diff to classify a single contiguous insert/delete. */
function computeDiff(oldText, newText) {
  if (oldText === newText) return null;
  let i = 0;
  const minLen = Math.min(oldText.length, newText.length);
  while (i < minLen && oldText[i] === newText[i]) i++;

  let j = 0;
  while (
    j < (minLen - i) &&
    oldText[oldText.length - 1 - j] === newText[newText.length - 1 - j]
  ) j++;

  const oldMid = oldText.slice(i, oldText.length - j);
  const newMid = newText.slice(i, newText.length - j);

  if (newMid.length > 0 && oldMid.length === 0) {
    return { type: "insert", start: i, end: i + newMid.length, nChars: newMid.length, text: newMid };
  } else if (oldMid.length > 0 && newMid.length === 0) {
    return { type: "delete", start: i, end: i + oldMid.length, nChars: oldMid.length, text: oldMid };
  } else {
    // complex replace (treat as delete + insert for simplicity)
    return {
      type: "replace",
      start: i,
      end: i + oldMid.length,
      nCharsDel: oldMid.length,
      nCharsIns: newMid.length,
      delText: oldMid,
      insText: newMid
    };
  }
}

/* ====== Main logger ====== */
(function () {
  const state = {
    started: false,
    startTime: null,
    lastInputTime: null,
    pauseActive: false,
    pauseStart: null,
    textPrev: "",
    gazeTimer: null,
    lastGazeSide: "unknown",
    lastGazeTime: null,
    writer: null,
    graph: null,
    // event buffers
    keystrokes: [],
    textchanges: [],
    pauses: [],
    gaze: [],          // raw region samples
    gaze_states: [],   // consolidated dwell segments (left/right)
  };

  function getCursorInfo(el) {
    return {
      selectionStart: el.selectionStart,
      selectionEnd: el.selectionEnd,
      textLen: el.value.length
    };
  }

  /* ---- Keystroke listeners ---- */
  function onKeydown(e) {
    const t = now();
    if (!state.writer) return;
    const ci = getCursorInfo(state.writer);
    state.keystrokes.push({
      time: t,
      key: e.key,
      code: e.code,
      selectionStart: ci.selectionStart,
      selectionEnd: ci.selectionEnd,
      textLen: ci.textLen
    });
  }

  function onInput(e) {
    const t = now();
    if (!state.writer) return;
    const current = state.writer.value;
    const diff = computeDiff(state.textPrev, current);
    const ci = getCursorInfo(state.writer);

    if (diff) {
      state.textchanges.push({
        time: t,
        ...diff,
        cursorAfter: ci.selectionStart
      });
    }

    // pause detection
    if (state.pauseActive) {
      // we were in a pause; close it
      const dur = t - state.pauseStart;
      state.pauses.push({
        startTime: state.pauseStart,
        endTime: t,
        duration: dur,
        cursorIndexAtPause: ci.selectionStart
      });
      state.pauseActive = false;
      state.pauseStart = null;
    }
    state.lastInputTime = t;
    state.textPrev = current;
  }

  /* ---- Pause monitor ---- */
  let pauseChecker = null;
  function startPauseChecker() {
    stopPauseChecker();
    pauseChecker = setInterval(() => {
      if (!state.started) return;
      const t = now();
      if (state.lastInputTime === null) return;
      const gap = t - state.lastInputTime;
      if (!state.pauseActive && gap >= PAUSE_THRESHOLD_MS) {
        state.pauseActive = true;
        state.pauseStart = state.lastInputTime;
      }
    }, 100);
  }
  function stopPauseChecker() {
    if (pauseChecker) {
      clearInterval(pauseChecker);
      pauseChecker = null;
    }
  }

  /* ---- Gaze (WebGazer) ---- */
  function pointInRect(x, y, rect) {
    return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
  }

  function getGazeSide(x, y) {
    // Prefer element-based AOIs if present; fall back to screen midline
    const wRect = state.writer ? state.writer.getBoundingClientRect() : null;
    const gRect = state.graph ? state.graph.getBoundingClientRect() : null;

    if (gRect && pointInRect(x, y, gRect)) return "left";
    if (wRect && pointInRect(x, y, wRect)) return "right";

    // fallback: midline split
    const mid = window.innerWidth / 2;
    if (x < mid) return "left";
    if (x >= mid) return "right";
    return "unknown";
  }

  function logGazeState(side, t) {
    // close last segment if side changed and last segment lasted long enough
    if (state.lastGazeSide !== side) {
      if (state.lastGazeSide !== "unknown" && state.lastGazeTime != null) {
        const dur = t - state.lastGazeTime;
        if (dur >= GAZE_MIN_DWELL_MS) {
          state.gaze_states.push({
            side: state.lastGazeSide,
            startTime: state.lastGazeTime,
            endTime: t,
            duration: dur
          });
        }
      }
      state.lastGazeSide = side;
      state.lastGazeTime = t;
    }
  }

  function startGaze() {
    if (!window.webgazer) return; // safe no-op
    // If Gorilla already started WebGazer, we just poll its predictions
    stopGaze();
    state.gazeTimer = setInterval(async () => {
      try {
        const pred = await window.webgazer.getCurrentPrediction();
        const t = now();
        if (!pred) return;
        const x = pred.x;
        const y = pred.y;
        const side = getGazeSide(x, y);
        state.gaze.push({ time: t, x, y, side });
        logGazeState(side, t);
      } catch (e) {
        // ignore transient webgazer errors
      }
    }, GAZE_SAMPLE_EVERY_MS);
  }

  function stopGaze() {
    if (state.gazeTimer) {
      clearInterval(state.gazeTimer);
      state.gazeTimer = null;
    }
    // finalize any open gaze segment
    const t = now();
    if (state.lastGazeSide !== "unknown" && state.lastGazeTime != null) {
      const dur = t - state.lastGazeTime;
      if (dur >= GAZE_MIN_DWELL_MS) {
        state.gaze_states.push({
          side: state.lastGazeSide,
          startTime: state.lastGazeTime,
          endTime: t,
          duration: dur
        });
      }
    }
    state.lastGazeSide = "unknown";
    state.lastGazeTime = null;
  }

  /* ---- Public API ---- */
  const etl = {
    startLogging() {
      if (state.started) return;
      state.writer = document.getElementById("writer");
      state.graph  = document.getElementById("graph");
      if (!state.writer) {
        console.warn("[ETL] No #writer element found. Keystroke logging disabled.");
      } else {
        state.textPrev = state.writer.value || "";
        state.writer.addEventListener("keydown", onKeydown);
        state.writer.addEventListener("input", onInput);
      }

      state.started = true;
      state.startTime = now();
      state.lastInputTime = state.startTime;

      startPauseChecker();
      startGaze();
    },

    stopLogging() {
      if (!state.started) return null;
      state.started = false;

      if (state.writer) {
        state.writer.removeEventListener("keydown", onKeydown);
        state.writer.removeEventListener("input", onInput);
      }

      // Close an active pause if trial ends during a pause
      const t = now();
      if (state.pauseActive && state.pauseStart != null) {
        state.pauses.push({
          startTime: state.pauseStart,
          endTime: t,
          duration: t - state.pauseStart,
          cursorIndexAtPause: state.writer ? state.writer.selectionStart : null
        });
        state.pauseActive = false;
        state.pauseStart = null;
      }

      stopPauseChecker();
      stopGaze();

      const payload = {
        meta: {
          version: "etl-1.0",
          startedAt: state.startTime,
          endedAt: t,
          pauseThresholdMs: PAUSE_THRESHOLD_MS,
          gazeSampleEveryMs: GAZE_SAMPLE_EVERY_MS
        },
        keystrokes: state.keystrokes,
        textchanges: state.textchanges,
        pauses: state.pauses,
        gaze_raw: state.gaze,
        gaze_states: state.gaze_states
      };

      // Reset for next trial
      state.keystrokes = [];
      state.textchanges = [];
      state.pauses = [];
      state.gaze = [];
      state.gaze_states = [];

      return JSON.stringify(payload);
    }
  };

  // expose for Gorilla to call
  window.etl = etl;

  // Optional: auto-start immediately
  // window.addEventListener("load", () => window.etl.startLogging());
})();
</script>