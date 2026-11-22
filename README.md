# Manga Kanji (漫画漢字)

A minimalist mobile companion app for reading physical Japanese manga. Take a photo of any manga page to catalogue Kanji and compound words (jukugo), extract dialogue bubbles with translations and nuance explanations, look up readings in an offline dictionary, or search your catalogue by sketching characters with your finger.

---

## Features

### 1. Precision Manga Vision Scanning
* **Manga Reading Order**: Scans pages following traditional right-to-left, top-to-bottom reading flow.
* **Kanji & Compound Extraction**: Isolates individual Kanji characters and multi-kanji compound words (*jukugo*) with contextual hiragana readings and definitions.
* **Halftone & SFX Filtering**: Trained vision models ignore screentone patterns, furigana kana, sound effects (*giseigo/gitaigo*), and background artwork.
* **Direct Input & Clipboard**: Supports pasting Japanese text directly in addition to photo scanning.

### 2. Dialogue Translation & Nuance Notes
* **Bubble-by-Bubble Extraction**: Identifies each speech bubble and narrative thought sequentially.
* **Faithful English Translation**: Captures character voice, informal registers, and tone.
* **Subtleties & Context**: Explains character pronouns (*ore*, *boku*, *watashi*), archaic kanji forms (e.g., 拾 for 10), idioms, slang, and cultural double-meanings.

### 3. Handwriting Search by Drawing
* **Finger Canvas**: Built-in 2D sketching pad with traditional Japanese kanji practice crosshair grid lines.
* **Sub-100ms Stroke Recognition**: Real-time handwriting recognition matches drawn strokes to candidate Kanji characters.
* **Resemblance Sorting**: Displays candidates in order of resemblance and highlights characters already in your catalogue. Sort the entire catalogue by closest visual match with a single tap.

### 4. Comprehensive Offline Dictionary
* **KANJIDIC Integration**: 13,000+ Kanji lookup offline with meanings, onyomi, kunyomi, JLPT level (N5–N1), stroke count, and grade.
* **Frequency Tracking**: Counts cumulative occurrences of each Kanji and compound word across all your manga reading sessions.

### 5. Reading History & Session Log
* Stores past manga scan sessions with timestamps, Kanji counts, compound lists, and full dialogue translations.
* Filter, sort, or review past scans anytime.

---

## Tech Stack

* **Framework**: [Expo](https://expo.dev) (SDK 58) / [React Native](https://reactnative.dev) 0.88 / [React 19](https://react.dev)
* **Language**: TypeScript
* **Vision / AI**: Google Gemini API (`gemini-3.5-flash` / `gemini-3.1-flash-lite`)
* **Handwriting Recognition**: Google Input Tools Japanese Handwriting Engine
* **Offline Dictionary**: KANJIDIC via `kanji.js`
* **Vector Graphics**: `react-native-svg`
* **Storage**: `@react-native-async-storage/async-storage`

---

## Getting Started

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

3. **Configure Environment Variables**:
   Copy `.env.example` to `.env` and enter your Gemini API key:
   ```bash
   cp .env.example .env
   ```
   Add your key in `.env`:
   ```env
   EXPO_PUBLIC_GEMINI_API_KEY=your_gemini_api_key_here
   ```

4. **Start the development server**:
   ```bash
   npx expo start
   ```

5. **Open on your device**:
   Scan the displayed QR code with your iPhone Camera (iOS) or the Expo Go app (Android).

---

## Project Structure

```
├── App.tsx                        # Main container, safe area, tab routing
├── app.json                       # Expo configuration
├── src/
│   ├── types.ts                   # Core data models (Kanji, Compounds, Blurbs, Scans)
│   ├── components/
│   │   ├── ScanTab.tsx            # Camera capture, photo library, text input
│   │   ├── ScanSummaryModal.tsx   # Review sheet: Kanji, Compounds, Translation tabs
│   │   ├── CatalogTab.tsx         # Searchable, filterable Kanji & compound catalogue
│   │   ├── HistoryTab.tsx         # Scan history sessions log and detail modal
│   │   ├── DrawKanjiModal.tsx     # Canvas drawing pad for handwriting search
│   │   ├── KanjiCard.tsx          # Minimalist Kanji list item card
│   │   └── KanjiDetailModal.tsx   # Full offline dictionary modal for individual Kanji
│   └── services/
│       ├── visionScanner.ts       # Gemini Vision prompt & response parser
│       ├── handwritingRecognizer.ts # Real-time stroke recognition service
│       ├── dictionary.ts          # KANJIDIC offline lookup
│       ├── kanjiExtractor.ts      # Pure CJK character regex isolation
│       └── storage.ts             # AsyncStorage persistence for catalogue, compounds & history
└── scripts/
    └── patch-expo.js              # Expo CLI runtime compatibility patch
```

---

## License

MIT
