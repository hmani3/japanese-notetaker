import AsyncStorage from '@react-native-async-storage/async-storage';
import { DialogueBlurb, ExtractedScanData, ScannedCompoundItem } from '../types';
import { extractKanji } from './kanjiExtractor';

const API_KEY_STORAGE = '@manga_kanji_gemini_key';
const DEFAULT_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY || '';
const REQUEST_TIMEOUT_MS = 28000;

export async function getApiKey(): Promise<string> {
  const custom = await AsyncStorage.getItem(API_KEY_STORAGE);
  const key = custom || DEFAULT_KEY;
  if (!key) {
    throw new Error('Gemini API key is not configured. Tap "Key" in the top right to add yours.');
  }
  return key;
}

export async function setApiKey(key: string): Promise<void> {
  await AsyncStorage.setItem(API_KEY_STORAGE, key.trim());
}

const SCAN_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    blurbs: {
      type: 'ARRAY',
      description:
        'All speech bubbles, thought bubbles, and narration boxes in exact manga reading order (right-to-left, top-to-bottom).',
      items: {
        type: 'OBJECT',
        properties: {
          japanese: {
            type: 'STRING',
            description: 'Exact Japanese text transcribed from the bubble (excluding furigana).',
          },
          translation: {
            type: 'STRING',
            description: 'Natural, faithful English translation capturing tone and character voice.',
          },
          notes: {
            type: 'STRING',
            description:
              'Concise notes on subtleties, pronouns, grammar, idioms, archaic kanji, or context.',
          },
          box: {
            type: 'ARRAY',
            description:
              'Normalized bounding box [ymin, xmin, ymax, xmax] on a 0 to 1000 scale enclosing this speech bubble or text block.',
            items: { type: 'INTEGER' },
          },
        },
        required: ['japanese', 'translation', 'notes', 'box'],
      },
    },
    compounds: {
      type: 'ARRAY',
      description:
        'All Kanji words/compounds (jukugo, multi-kanji names, and standalone kanji words) in order of appearance.',
      items: {
        type: 'OBJECT',
        properties: {
          compound: { type: 'STRING' },
          reading: { type: 'STRING', description: 'Contextual reading in hiragana.' },
          meaning: { type: 'STRING', description: 'Concise English definition.' },
        },
        required: ['compound', 'reading', 'meaning'],
      },
    },
  },
  required: ['blurbs', 'compounds'],
};

const PROMPT_INSTRUCTIONS =
  'You are an expert Japanese manga OCR and translation engine.\n' +
  'Step 1 — Reading Order: Identify the manga panels in traditional Japanese reading order: top-right panel first, moving right-to-left across each row of panels, then top-to-bottom. Within each panel, read speech bubbles and narration boxes from rightmost to leftmost, top to bottom. Within each vertical bubble, read columns from rightmost column to leftmost column, top to bottom.\n' +
  'Step 2 — Transcribe & Translate ("blurbs"): For each bubble/box in that exact reading order, transcribe the exact Japanese text ("japanese"), provide a natural English translation ("translation"), explain subtleties/pronouns/grammar/nuances ("notes"), and output its normalized bounding box "box": [ymin, xmin, ymax, xmax] (0 to 1000 scale). Omit tiny furigana ruby readings and pure kana sound effects (SFX).\n' +
  'Step 3 — Extract Compounds ("compounds"): List every Kanji word/compound (jukugo, kanji names, or standalone kanji words) appearing in the transcribed dialogue in the same order of appearance, with its contextual hiragana "reading" and concise English "meaning". Do NOT include pure kana words.\n' +
  'Be 100% faithful to the actual text on the page—never invent or guess unseen dialogue.';

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number = REQUEST_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function countOccurrences(haystack: string, needle: string): number {
  if (!haystack || !needle) return 0;
  let count = 0;
  let pos = 0;
  while ((pos = haystack.indexOf(needle, pos)) !== -1) {
    count += 1;
    pos += needle.length;
  }
  return count;
}

function parseGeminiScanResponse(jsonText: string): ExtractedScanData {
  let parsed: any = {};
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    const match =
      jsonText.match(/```json\s*([\s\S]*?)\s*```/) ||
      jsonText.match(/```\s*([\s\S]*?)\s*```/);
    if (match) {
      try {
        parsed = JSON.parse(match[1]);
      } catch {
        parsed = {};
      }
    }
  }

  // 1. Process blurbs first (canonical R->L, top-to-bottom order)
  const rawBlurbs = Array.isArray(parsed.blurbs) ? parsed.blurbs : [];
  const blurbs: DialogueBlurb[] = [];
  let blurbIndex = 0;

  for (const item of rawBlurbs) {
    if (!item) continue;
    const japanese = String(item.japanese || item.text || item.original || '').trim();
    const translation = String(item.translation || item.english || '').trim();
    const notes = String(item.notes || item.explanation || item.subtleties || '').trim();

    let box: [number, number, number, number] | undefined;
    if (Array.isArray(item.box) && item.box.length === 4) {
      const nums = item.box.map((n: any) => Math.max(0, Math.min(1000, Number(n))));
      if (nums.every((n: number) => Number.isFinite(n)) && nums[2] > nums[0] && nums[3] > nums[1]) {
        box = [nums[0], nums[1], nums[2], nums[3]];
      }
    }

    if (japanese || translation) {
      blurbs.push({
        orderIndex: blurbIndex++,
        japanese,
        translation,
        notes: notes || 'No special nuance notes provided.',
        ...(box ? { box } : {}),
      });
    }
  }

  // 2. Derive individual Kanji deterministically from ordered blurbs (guaranteeing exact order & counts)
  const orderedDialogueText = blurbs.map((b) => b.japanese).join('');
  let rawKanjiFallback = '';
  if (Array.isArray(parsed.kanji_in_order)) {
    rawKanjiFallback = parsed.kanji_in_order.map(String).join('');
  }
  const individual = extractKanji(orderedDialogueText || rawKanjiFallback);

  // 3. Process compounds and sort deterministically by first appearance in orderedDialogueText
  const rawCompounds = Array.isArray(parsed.compounds) ? parsed.compounds : [];
  const compoundsMap: Record<
    string,
    ScannedCompoundItem & { firstPos: number; modelIndex: number }
  > = {};
  let modelOrder = 0;

  for (const item of rawCompounds) {
    const word = String(item.compound || item.word || '').trim();
    if (!word || !/[\u4E00-\u9FAF\u3400-\u4DBF\uF900-\uFAFF]/.test(word)) {
      continue;
    }

    const reading = String(item.reading || item.hiragana || '').trim();
    const meaning = String(item.meaning || '').trim();

    if (compoundsMap[word]) {
      compoundsMap[word].countOnPage += 1;
    } else {
      const firstPos = orderedDialogueText ? orderedDialogueText.indexOf(word) : -1;
      const textCount = orderedDialogueText ? countOccurrences(orderedDialogueText, word) : 0;
      compoundsMap[word] = {
        compound: word,
        reading: reading || '—',
        meaning: meaning || 'No definition',
        countOnPage: textCount > 0 ? textCount : 1,
        orderIndex: modelOrder,
        firstPos: firstPos !== -1 ? firstPos : Number.MAX_SAFE_INTEGER,
        modelIndex: modelOrder++,
      };
    }
  }

  const sortedCompounds: ScannedCompoundItem[] = Object.values(compoundsMap)
    .sort((a, b) => {
      if (a.firstPos !== b.firstPos) return a.firstPos - b.firstPos;
      return a.modelIndex - b.modelIndex;
    })
    .map((item, idx) => ({
      compound: item.compound,
      reading: item.reading,
      meaning: item.meaning,
      countOnPage: item.countOnPage,
      orderIndex: idx,
    }));

  return {
    individual,
    compounds: sortedCompounds,
    blurbs,
  };
}

function buildGenerationConfig(model: string) {
  const base: Record<string, any> = {
    temperature: 0.1,
    responseMimeType: 'application/json',
    responseSchema: SCAN_RESPONSE_SCHEMA,
  };

  if (model.startsWith('gemini-3.8') || model.startsWith('gemini-3.7') || model.startsWith('gemini-3.6')) {
    base.thinkingConfig = { thinkingLevel: 'low' };
  }

  return base;
}

export async function scanMangaImage(
  base64Image: string,
  mimeType: string = 'image/jpeg'
): Promise<ExtractedScanData> {
  const apiKey = await getApiKey();
  const models = ['gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-3.5-flash'];
  let lastError: any = null;

  for (const model of models) {
    try {
      const body = {
        contents: [
          {
            parts: [
              {
                inlineData: {
                  mimeType,
                  data: base64Image,
                },
              },
              {
                text: PROMPT_INSTRUCTIONS,
              },
            ],
          },
        ],
        generationConfig: buildGenerationConfig(model),
      };

      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const response = await fetchWithTimeout(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        const json = await response.json();
        const text = json?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
        return parseGeminiScanResponse(text);
      } else {
        const errJson = await response.json().catch(() => null);
        lastError = new Error(errJson?.error?.message || `Status ${response.status}`);
        // Don't retry on invalid API key (400/401/403)
        if (response.status === 401 || response.status === 403) {
          throw lastError;
        }
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        lastError = new Error('Scan timed out. Please try again with a clearer or smaller photo.');
      } else {
        lastError = err;
      }
    }
  }

  throw lastError || new Error('Could not analyze manga image.');
}

/**
 * Extracts individual Kanji and compounds from directly pasted or typed Japanese text.
 */
export async function scanMangaText(text: string): Promise<ExtractedScanData> {
  const apiKey = await getApiKey();

  const prompt =
    `Analyze the following Japanese manga text in exact reading order:\n"""\n${text}\n"""\n` +
    '1. Split into logical dialogue/narrative units in "blurbs" with exact "japanese", natural English "translation", and nuance "notes".\n' +
    '2. Extract all Kanji words/compounds in "compounds" with contextual hiragana "reading" and concise English "meaning".';

  const models = ['gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-3.5-flash'];
  for (const model of models) {
    try {
      const body = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: buildGenerationConfig(model),
      };

      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const response = await fetchWithTimeout(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        const json = await response.json();
        const resText = json?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
        return parseGeminiScanResponse(resText);
      }
    } catch {
      // Fallback below
    }
  }

  // Offline fallback
  const individual = extractKanji(text);
  const compoundMatches = text.match(/[\u4E00-\u9FAF\u3400-\u4DBF]{2,}/g) || [];
  const compoundsMap: Record<string, ScannedCompoundItem> = {};
  let idx = 0;
  for (const c of compoundMatches) {
    if (compoundsMap[c]) {
      compoundsMap[c].countOnPage += 1;
    } else {
      compoundsMap[c] = {
        compound: c,
        reading: '—',
        meaning: 'Compound word',
        countOnPage: 1,
        orderIndex: idx++,
      };
    }
  }

  const fallbackBlurbs: DialogueBlurb[] = text.trim()
    ? [
        {
          orderIndex: 0,
          japanese: text.trim(),
          translation: 'Offline raw text (Connect to internet for AI nuance translation)',
          notes: 'Directly pasted snippet',
        },
      ]
    : [];

  return {
    individual,
    compounds: Object.values(compoundsMap),
    blurbs: fallbackBlurbs,
  };
}
