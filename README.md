## **Text Tools – Humanizer AI (Chrome Extension)**

A privacy-focused Chrome extension that humanizes text using a **local LLM** (LM Studio). No cloud calls. No data leaves your machine.
Customize tone, perspective, style, and even auto-mask PII before rewriting.

---

## 🚀 Features

### ✅ **Humanize Text Using Local LLM**

* Works offline using **LM Studio**
* Adjustable **tone**, **style**, and **perspective**
* Designed for clarity, readability, and natural-sounding results

### ✅ **Privacy First**

* Mask PII before rewriting (emails, phones, names)
* Option to restore PII afterward
* Nothing is sent to the internet — ever

### ✅ **Polished UI**

* Clean, responsive popup interface
* Advanced options panel
* Live word + character count
* Copy-to-clipboard
* Keyboard shortcut: **Ctrl + Enter**

---

## 📦 Files Overview

| File            | Purpose                                                           |
| --------------- | ----------------------------------------------------------------- |
| `manifest.json` | Chrome extension manifest (Manifest V3)                           |
| `popup.html`    | Extension popup UI                                                |
| `popup.js`      | Full logic for LLM requests, PII masking, UI state, and rewriting |
| `icons/`        | Extension icons (16/48/128px)                                     |

---

## 🔧 Requirements

### ✅ LM Studio Running Locally

This extension expects LM Studio at:

```
http://localhost:1234/v1/chat/completions
```

Be sure to:

1. Open LM Studio
2. Load and **start a model** (e.g., `llama-3.2-3b-instruct`)
3. Enable the **local HTTP server**

---

## 🧪 How to Load the Extension in Chrome (Developer Mode)

1. Open **chrome://extensions**
2. Enable **Developer mode** (top right)
3. Click **Load unpacked**
4. Select your extension folder (the one containing `manifest.json`)

You should now see the extension in your toolbar 🎉

---

## 📁 Project Structure

```
text-tools-humanizer/
│── manifest.json
│── popup.html
│── popup.js
│── icons/
│     ├── icon16.png
│     ├── icon48.png
│     └── icon128.png
└── README.md
```

---

## 🛠 How It Works (Short Explanation)

* The text is optionally masked using the **PIIMasker** class
* A dynamic prompt is created based on:

  * text length
  * tone
  * style
  * perspective
* Extension sends request to LM Studio running locally
* Response is cleaned by `PostProcessor`
* PII is optionally restored
* Output is placed in UI

Everything is fully local.

---

## ✅ Roadmap / Future Ideas

* Add custom model selection
* Add "rewrite multiple versions"
* Add export functionality
* Option to save presets

---

## 📜 License

MIT License 
# Want me to auto-generate the README as a file?

Happy to! I can spit out an actual `.md` file you can download — just say the word.

Or if you want a more fancy GitHub-style README (with badges, GIF demos, or screenshots), I can dress it up.
