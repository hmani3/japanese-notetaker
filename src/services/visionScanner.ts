import AsyncStorage from '@react-native-async-storage/async-storage';
import { DialogueBlurb, ExtractedScanData, ScannedCompoundItem } from '../types';
import { extractKanji } from './kanjiExtractor';

const API_KEY_STORAGE = '@manga_kanji_gemini_key';
const DEFAULT_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY || '';
const REQUEST_TIMEOUT_MS = 14000;

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
        'All speech bubbles, thought bubbles, and narration boxes in manga reading order (right-to-left, top-to-bottom).',
      items: {
        type: 'OBJECT',
        properties: {
          japanese: {
            type: 'STRING',
            description: 'Exact Japanese text transcribed from the bubble (omit tiny furigana).',
          },
          translation: {
            type: 'STRING',
            description: 'Natural English translation capturing tone.',
          },
          notes: {
            type: 'STRING',
            description:
              'Optional 1 concise sentence ONLY if there is notable Japanese linguistic, literary, or cultural nuance (keigo/register, archaic kanji, idioms, dialects, wordplay, speech style). Return "" if none.',
          },
          box: {
            type: 'ARRAY',
            description: 'Bounding box [ymin, xmin, ymax, xmax] on 0-1000 scale.',
            items: { type: 'INTEGER' },
          },
        },
        required: ['japanese', 'translation', 'notes', 'box'],
      },
    },
    compounds: {
      type: 'ARRAY',
      description: 'Kanji words/compounds (jukugo, kanji names, kanji words) in reading order.',
      items: {
        type: 'OBJECT',
        properties: {
          compound: { type: 'STRING' },
          reading: { type: 'STRING', description: 'Hiragana reading.' },
          meaning: { type: 'STRING', description: 'Short English definition.' },
        },
        required: ['compound', 'reading', 'meaning'],
      },
    },
  },
  required: ['blurbs', 'compounds'],
};

const SYSTEM_INSTRUCTION =
  'You are a fast, exact Japanese manga OCR and translation engine. Follow traditional manga reading order strictly: panels top-right to bottom-left; bubbles rightmost to leftmost; vertical columns rightmost to leftmost, top to bottom. Omit tiny furigana and pure kana SFX. Never invent unseen text. For "notes", focus ONLY on Japanese linguistic, literary, or cultural context (register/keigo, archaic kanji/kana, idioms, dialects, allusions, wordplay, pronoun/speech style)—never plot recap or general framing. If there is no specific nuance, return "" for "notes".';

const IMAGE_PROMPT =
  'Extract all dialogue/narration bubbles in exact R->L, top->bottom order into "blurbs" (japanese, translation, optional 1-sentence Japanese linguistic/literary/cultural notes or "", and [ymin, xmin, ymax, xmax] 0-1000 box), and all Kanji words/compounds into "compounds" (compound, hiragana reading, short meaning).';

const FILLER_NOTE_REGEX =
  /^(none\.?|n\/a\.?|null|no (special |notable |specific )?(linguistic|literary|cultural )?nuances?( or context)?( provided| needed| here)?\.?|nothing (notable|special)\.?|-|—)$/i;

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
    const rawNotes = String(item.notes || item.explanation || item.subtleties || '').trim();
    const notes = FILLER_NOTE_REGEX.test(rawNotes) ? '' : rawNotes;

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
        notes,
        ...(box ? { box } : {}),
      });
    }
  }

  // 2. Derive individual Kanji deterministically from ordered blurbs
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
      // Only count substring matches for multi-character compounds to avoid matching inside jukugo
      const textCount =
        word.length >= 2 && orderedDialogueText ? countOccurrences(orderedDialogueText, word) : 0;
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
  const config: Record<string, any> = {
    responseMimeType: 'application/json',
    responseSchema: SCAN_RESPONSE_SCHEMA,
  };

  if (model.startsWith('gemini-3.5-flash-lite') || model.startsWith('gemini-3.6-flash')) {
    config.thinkingConfig = { thinkingLevel: 'MINIMAL' };
  } else if (model.startsWith('gemini-2.5-flash-lite')) {
    config.thinkingConfig = { thinkingBudget: 0 };
  }

  return config;
}

async function callGeminiWithFallback(
  models: string[],
  userParts: any[]
): Promise<ExtractedScanData> {
  const apiKey = await getApiKey();
  let lastError: any = null;

  for (const model of models) {
    try {
      const body = {
        systemInstruction: {
          parts: [{ text: SYSTEM_INSTRUCTION }],
        },
        contents: [
          {
            role: 'user',
            parts: userParts,
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
        const candidate = json?.candidates?.[0];
        const finishReason = candidate?.finishReason;

        if (
          finishReason === 'SAFETY' ||
          finishReason === 'PROHIBITED_CONTENT' ||
          finishReason === 'BLOCKLIST'
        ) {
          throw new Error('This page triggered the AI safety filter and could not be read.');
        }

        const text = candidate?.content?.parts?.[0]?.text || '{}';
        return parseGeminiScanResponse(text);
      } else {
        const errJson = await response.json().catch(() => null);
        const msg = errJson?.error?.message || `Status ${response.status}`;
        lastError = new Error(msg);

        if (
          response.status === 401 ||
          response.status === 403 ||
          (response.status === 400 && /api.?key/i.test(msg))
        ) {
          throw new Error('Invalid or unauthorized Gemini API key. Check your key in "Key".');
        }
        if (response.status === 429) {
          lastError = new Error('Free-tier rate limit reached. Wait a few seconds and try again.');
        }
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        lastError = new Error('Scan timed out (>14s). Try a closer crop or better lighting.');
      } else {
        lastError = err;
        if (
          err?.message?.includes('API key') ||
          err?.message?.includes('safety filter')
        ) {
          throw err;
        }
      }
    }
  }

  throw lastError || new Error('Could not analyze manga content.');
}

export async function scanMangaImage(
  base64Image: string,
  mimeType: string = 'image/jpeg'
): Promise<ExtractedScanData> {
  return callGeminiWithFallback(
    ['gemini-3.5-flash-lite', 'gemini-3.6-flash', 'gemini-2.5-flash-lite'],
    [
      {
        inlineData: {
          mimeType,
          data: base64Image,
        },
      },
      {
        text: IMAGE_PROMPT,
      },
    ]
  );
}

/**
 * Extracts individual Kanji and compounds from directly pasted or typed Japanese text.
 */
export async function scanMangaText(text: string): Promise<ExtractedScanData> {
  const prompt =
    `Analyze this Japanese manga text in exact reading order:\n"""\n${text}\n"""\n` +
    'Split into "blurbs" (japanese, translation, optional 1-sentence Japanese linguistic/literary/cultural notes or "", [0,0,0,0] box) and extract Kanji words into "compounds" (compound, hiragana reading, short meaning).';

  try {
    return await callGeminiWithFallback(
      ['gemini-3.5-flash-lite', 'gemini-2.5-flash-lite'],
      [{ text: prompt }]
    );
  } catch (err: any) {
    if (err?.message?.includes('API key') || err?.message?.includes('safety filter')) {
      throw err;
    }
  }

  // Offline / transient network fallback
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
          translation: 'Offline raw text (Connect to internet for AI translation)',
          notes: '',
        },
      ]
    : [];

  return {
    individual,
    compounds: Object.values(compoundsMap),
    blurbs: fallbackBlurbs,
  };
}
