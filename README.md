# 🧠 Eye-Tracking + Keystroke Logging (WebGazer + JS)

**Author:** [Adam A. Bramlett](https://www.adamabramlett.com)  
**Affiliation:** Carnegie Mellon University · LAPP Lab  
**Repository:** [jscript_gorilla_keystroke_logging](https://github.com/AdamAnderB/jscript_gorilla_keystroke_logging)  
**License:** © Carnegie Mellon University · Shared under [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/)

---

## 🌍 Overview

A lightweight **JavaScript framework** for collecting **keystroke-logging** and **webcam-based eye-tracking** data in one synchronized browser session — ideal for writing or graph-description tasks in **Gorilla**, **PsyToolkit**, or other web-based experiments.

The framework records typing behavior (keys, pauses, revisions, cursor positions) and gaze direction (left vs. right AOIs) using [WebGazer.js](https://webgazer.cs.brown.edu/), all on a single timeline.  
No plug-ins or desktop tools — just a browser.

---

## ⚙️ Features

### ✅ Keystroke Logging
- Captures every keypress with timestamp and cursor position  
- Detects pauses (≥ 2 s) and revisions (insert / delete / replace)  
- Computes pause duration and location within text  

### 👁️ Eye-Tracking
- Uses **WebGazer** for webcam-based gaze sampling  
- Classifies gaze as **Left (graph)** or **Right (textbox)**  
- Consolidates raw samples into clean dwell segments  

### 🧩 Integration
- Works directly in **Gorilla’s Script component** or any HTML page  
- Single-clock timing — no synchronization issues  
- Produces one unified JSON payload per trial  

---

## 🧰 File Structure

```
jscript_gorilla_keystroke_logging/
├── main.js      # Starts listeners, logs keystrokes & gaze
├── end.js       # Stops logging and saves JSON payload
└── README.md    # Documentation
```

---

## 🚀 Quick Start

1️⃣ **Add elements to your Gorilla screen (or HTML page):**

```html
<div id="graph">Your visual prompt here</div>
<textarea id="writer"></textarea>
```

2️⃣ **Include the scripts:**

```html
<script src="main.js"></script>
<script>
  window.etl.startLogging(); // begin logging on screen load
</script>
```

3️⃣ **At the end of the screen (or on the next screen):**

```html
<script src="end.js"></script>
```

This stops logging, compiles the data, and saves it to Gorilla as `etl_json`.

---

## 💾 Output Format

Each trial produces a structured JSON string:

```json
{
  "meta": {
    "version": "etl-1.0",
    "pauseThresholdMs": 2000,
    "gazeSampleEveryMs": 100
  },
  "keystrokes": [ { "time": 3456, "key": "a", ... } ],
  "textchanges": [ { "type": "insert", "start": 12, "nChars": 1, ... } ],
  "pauses": [ { "duration": 2350, "cursorIndexAtPause": 56 } ],
  "gaze_raw": [ { "time": 4123, "x": 220, "y": 180, "side": "left" } ],
  "gaze_states": [ { "side": "right", "duration": 500, ... } ]
}
```

---

## 🧪 Validation Notes

- Works best with **desktop webcams** and stable lighting  
- AOIs defined by `#graph` and `#writer`, or auto-split at the screen midline  
- Fails gracefully if **WebGazer** is unavailable (still logs keystrokes)  
- Adjust `PAUSE_THRESHOLD_MS` and `GAZE_SAMPLE_EVERY_MS` to match your experimental needs  
- Recommended to **pilot** with a few participants to fine-tune thresholds and camera calibration  
- Confirm IRB/privacy compliance: all gaze data stays local to the task and is never transmitted externally  

---

## 📚 Citation

If you use or adapt this code in a thesis, article, or dataset, please cite:

> **Bramlett, A. A. (2025).** *Eye-Tracking + Keystroke Logging (WebGazer + JS)* $begin:math:display$Code repository$end:math:display$. GitHub.  
> [https://github.com/AdamAnderB/jscript_gorilla_keystroke_logging](https://github.com/AdamAnderB/jscript_gorilla_keystroke_logging)

And, where relevant:

> **Bramlett & Wiener (2025).** *Focus Processing in L1 and L2 English.* *Research Methods in Applied Linguistics.*

---

## 🪶 Acknowledgments

Developed by **Adam A. Bramlett** at **Carnegie Mellon University’s LAPP Lab**, as part of ongoing research on **web-based cognitive and language processing** supported by the **Graduate Assessment Fellows Program**.

Special thanks to **Theres Grüter** for early feedback and to **Yoonseo Kim** for piloting the integration in her dissertation.

---

## 🪪 License

© 2025 Adam A Bramlett
Shared under the [Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International License](https://creativecommons.org/licenses/by-nc-sa/4.0/).  
You may use, adapt, and share this code for **non-commercial research or teaching** with attribution.

---

✅ *For questions or collaboration inquiries, please contact:*  
**Adam A. Bramlett** – [abramlet@andrew.cmu.edu](mailto:abramlet@andrew.cmu.edu)
