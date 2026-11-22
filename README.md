# Manga Kanji (漫画漢字)

A minimalist mobile companion app for reading physical Japanese manga. Take a photo of any manga page to catalogue Kanji and compound words (*jukugo*), extract dialogue bubbles with translations and nuance explanations, look up readings in an offline dictionary, or search your catalogue by sketching characters with your finger.

Available as both a **standalone Progressive Web App (PWA)** runnable directly on your phone, and a **native mobile app** via Expo / React Native.

**Live Web App**: [https://hmani3.github.io/japanese-notetaker/](https://hmani3.github.io/japanese-notetaker/)

---

## Features

### 1. Standalone Web & PWA (Run Anywhere on Your Phone)
* **Zero-Setup Mobile Access**: Open the live link in Safari or Chrome on your phone anytime without running a dev server or connecting via Expo Go.
* **Home Screen Install**: Add to your iOS or Android Home Screen for a full-screen, native-feeling app with custom app icon and edge-to-edge dark theme (`#131317` / `#111113`).
* **Dynamic Viewport & Notch Support**: Adaptive layout using modern dynamic viewport units (`100dvh`) and safe-area insets that seamlessly handle iPhone notches, Dynamic Islands, and home indicator bars.

### 2. Precision Manga Vision Scanning
* **Manga Reading Order**: Scans pages following traditional right-to-left, top-to-bottom reading flow.
* **Kanji & Compound Extraction**: Isolates individual Kanji characters and multi-kanji compound words (*jukugo*) with contextual hiragana readings and definitions.
* **Halftone & SFX Filtering**: Trained vision models ignore screentone patterns, furigana kana, sound effects (*giseigo/gitaigo*), and background artwork.
* **Direct Input & Clipboard**: Supports pasting Japanese text directly in addition to camera and photo library uploads.

### 3. Dialogue Translation & Nuance Notes
* **Bubble-by-Bubble Extraction**: Identifies each speech bubble and narrative thought sequentially.
* **Faithful English Translation**: Captures character voice, informal registers, and tone.
* **Subtleties & Context**: Explains character pronouns (*ore*, *boku*, *watashi*), archaic kanji forms (e.g., 拾 for 10), idioms, slang, and cultural double-meanings.

### 4. Handwriting Search by Drawing
* **Finger Canvas**: Built-in 2D sketching pad with traditional Japanese kanji practice crosshair grid lines.
* **Sub-100ms Stroke Recognition**: Real-time handwriting recognition matches drawn strokes to candidate Kanji characters.
* **Fixed-Canvas UI**: Drawing pad stays anchored in place while stroke recognition updates dynamically in a dedicated scrollable recommendation row.
* **Resemblance Sorting**: Displays candidates in order of resemblance and highlights characters already in your catalogue. Sort the entire catalogue by closest visual match with a single tap.

### 5. In-App API Key Management
* **Device Storage**: Save your Google Gemini API key directly inside the app; keys are stored in device local storage (`AsyncStorage`) and are never sent to third-party intermediary servers.
* **Show / Hide Visibility Toggle**: Toggle between plain text and masked display while typing your key or viewing your currently stored key.
* **One-Tap Clipboard Paste**: Quickly paste keys from your device clipboard.

### 6. Comprehensive Offline Dictionary
* **KANJIDIC Integration**: 13,000+ Kanji lookup offline with meanings, onyomi, kunyomi, JLPT level (N5–N1), stroke count, and grade.
* **Frequency Tracking**: Counts cumulative occurrences of each Kanji and compound word across all your manga reading sessions.

### 7. Reading History & Session Log
* Stores past manga scan sessions with timestamps, Kanji counts, compound lists, and full dialogue translations.
* Filter, sort, or review past scans anytime.

---

## Quick Start (Run Instantly on Mobile)

No laptop or terminal required:

1. On your phone, visit [https://hmani3.github.io/japanese-notetaker/](https://hmani3.github.io/japanese-notetaker/) in **Safari (iOS)** or **Chrome (Android)**.
2. Tap the **Key** button in the top-right header to paste your free [Gemini API Key](https://aistudio.google.com/).
3. *(Optional - Install as App)*:
   - **iOS (Safari)**: Tap the **Share** button (`􀈂`) → Select **Add to Home Screen**.
   - **Android (Chrome)**: Tap the menu (`⋮`) → Select **Install app** or **Add to Home screen**.
4. Launch directly from your Home Screen whenever you read manga!

---

## Local Development & Native App

### Prerequisites

* [Node.js](https://nodejs.org/) (v20.18+ or v22+)
* [Expo Go](https://expo.dev/go) installed on your iOS or Android device
* A free [Google Gemini API Key](https://aistudio.google.com/)

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/hmani3/japanese-notetaker.git
   cd japanese-notetaker
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables** (Optional for local dev):
   Copy `.env.example` to `.env` and enter your Gemini API key:
   ```bash
   cp .env.example .env
   ```
   Add your key in `.env`:
   ```env
   EXPO_PUBLIC_GEMINI_API_KEY=your_gemini_api_key_here
   ```
   *(Note: You can also configure the key at runtime using the in-app **Key** button).*

4. **Start the development server**:
   ```bash
   npx expo start
   ```

5. **Open on your device**:
   Scan the displayed QR code with your iPhone Camera (iOS) or the Expo Go app (Android).

---

## Building & Deploying the Web Version

The project includes automated scripts for exporting and deploying clean static builds to GitHub Pages with secrets stripped:

```bash
# Export static web bundle (strips sensitive env vars and injects PWA meta tags)
node scripts/build-web.js

# Build and force-push directly to origin:gh-pages branch
node scripts/deploy-pages.js
```

---

## Tech Stack

* **Framework**: [Expo](https://expo.dev) (SDK 58) / [React Native](https://reactnative.dev) 0.88 / [React 19](https://react.dev)
* **Web & PWA**: React Native Web with dynamic viewport (`100dvh`), `viewport-fit=cover`, and iOS standalone PWA support
* **Hosting**: GitHub Pages
* **Language**: TypeScript
* **Vision / AI**: Google Gemini API (`gemini-3.5-flash` / `gemini-3.1-flash-lite`)
* **Handwriting Recognition**: Google Input Tools Japanese Handwriting Engine
* **Offline Dictionary**: KANJIDIC via `kanji.js`
* **Vector Graphics**: `react-native-svg`
* **Storage**: `@react-native-async-storage/async-storage`

---

## Project Structure

```
├── App.tsx                        # Main container, safe area, tab routing, header
├── app.json                       # Expo configuration & base path
├── src/
│   ├── types.ts                   # Core data models (Kanji, Compounds, Blurbs, Scans)
│   ├── components/
│   │   ├── ScanTab.tsx            # Camera capture, photo library, text input
│   │   ├── ScanSummaryModal.tsx   # Review sheet: Kanji, Compounds, Translation tabs
│   │   ├── CatalogTab.tsx         # Searchable, filterable Kanji & compound catalogue
│   │   ├── HistoryTab.tsx         # Scan history sessions log and detail modal
│   │   ├── DrawKanjiModal.tsx     # Fixed-canvas drawing pad for handwriting search
│   │   ├── ApiKeyModal.tsx        # In-app Gemini API key manager with show/hide toggle
│   │   ├── KanjiCard.tsx          # Minimalist Kanji list item card
│   │   └── KanjiDetailModal.tsx   # Full offline dictionary modal for individual Kanji
│   └── services/
│       ├── visionScanner.ts       # Gemini Vision prompt, API caller & response parser
│       ├── handwritingRecognizer.ts # Real-time stroke recognition service
│       ├── dictionary.ts          # KANJIDIC offline lookup
│       ├── kanjiExtractor.ts      # Pure CJK character regex isolation
│       └── storage.ts             # AsyncStorage persistence for catalogue, compounds & history
└── scripts/
    ├── build-web.js               # Web bundle exporter & PWA meta tag injector
    ├── deploy-pages.js            # Automated deployment to GitHub Pages (gh-pages)
    └── patch-expo.js              # Expo CLI runtime compatibility patch
```

---

## License

MIT
