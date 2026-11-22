import AsyncStorage from '@react-native-async-storage/async-storage';
import { DialogueBlurb, ExtractedScanData, ScannedCompoundItem } from '../types';
import { extractKanji } from './kanjiExtractor';

const API_KEY_STORAGE = '@manga_kanji_gemini_key';
const DEFAULT_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY || '';

export async function getApiKey(): Promise<string> {
  const custom = await AsyncStorage.getItem(API_KEY_STORAGE);
  const key = custom || DEFAULT_KEY;
  if (!key) {
    throw new Error('Gemini API key is not configured. Add it in .env or settings.');
  }
  return key;
}

export async function setApiKey(key: string): Promise<void> {
  await AsyncStorage.setItem(API_KEY_STORAGE, key.trim());
}

const PROMPT_INSTRUCTIONS =
  'Examine this manga page. Read all speech bubbles, dialogue, and narration in traditional manga reading order (from right to left, top to bottom).\n' +
  'Extract three categories:\n' +
  '1. "compounds": An array of all Kanji words/compounds (jukugo, multi-kanji names, and standalone kanji words) in order of appearance. For each provide:\n' +
  '   - "compound": the word in Kanji (e.g. "呼吸", "全集中")\n' +
  '   - "reading": the contextual reading in Hiragana (e.g. "こきゅう", "ぜんしゅうちゅう")\n' +
  '   - "meaning": concise English definition\n' +
  '2. "kanji_in_order": An array of every single individual Kanji character in exact order of appearance from right to left, top to bottom. Repeat a Kanji if it appears multiple times.\n' +
  '3. "blurbs": An array of each dialogue speech bubble, thought, or conjoined narrative sentence in reading order (R->L, top-to-bottom). For each provide:\n' +
  '   - "japanese": the complete Japanese dialogue or sentence as seen on the page\n' +
  '   - "translation": natural, faithful English translation capturing tone and intent\n' +
  '   - "notes": concise explanation of subtleties, nuances, character pronouns/tone, grammar subtleties, archaic forms, or cultural/story context\n' +
  'Strict rules:\n' +
  '- Do NOT include pure kana sound effects (SFX), furigana kana, or non-kanji words in "compounds".\n' +
  '- Do NOT include any Hiragana, Katakana, English, or punctuation in "kanji_in_order".\n' +
  '- Output ONLY valid JSON matching this schema: {"compounds": [{"compound": "...", "reading": "...", "meaning": "..."}], "kanji_in_order": ["..."], "blurbs": [{"japanese": "...", "translation": "...", "notes": "..."}]}';

function parseGeminiScanResponse(jsonText: string): ExtractedScanData {
  let parsed: any = {};
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    // If response was wrapped in markdown code blocks ```json ... ```
    const match = jsonText.match(/```json\s*([\s\S]*?)\s*```/) || jsonText.match(/```\s*([\s\S]*?)\s*```/);
    if (match) {
      try {
        parsed = JSON.parse(match[1]);
      } catch {
        parsed = {};
      }
    }
  }

  // 1. Process individual kanji
  let rawKanjiList: string[] = [];
  if (Array.isArray(parsed.kanji_in_order)) {
    rawKanjiList = parsed.kanji_in_order.map(String);
  }
  const kanjiString = rawKanjiList.join('') || jsonText;
  const individual = extractKanji(kanjiString);

  // 2. Process compounds
  const rawCompounds = Array.isArray(parsed.compounds) ? parsed.compounds : [];
  const compoundsMap: Record<string, ScannedCompoundItem> = {};
  let compoundOrder = 0;

  for (const item of rawCompounds) {
    const word = String(item.compound || item.word || '').trim();
    // Verify word actually contains at least one Kanji
    if (!word || !/[\u4E00-\u9FAF\u3400-\u4DBF\uF900-\uFAFF]/.test(word)) {
      continue;
    }

    const reading = String(item.reading || item.hiragana || '').trim();
    const meaning = String(item.meaning || '').trim();

    if (compoundsMap[word]) {
      compoundsMap[word].countOnPage += 1;
    } else {
      compoundsMap[word] = {
        compound: word,
        reading: reading || '—',
        meaning: meaning || 'No definition',
        countOnPage: 1,
        orderIndex: compoundOrder++,
      };
    }
  }

  // 3. Process blurbs (dialogue & narrative translations with nuance notes)
  const rawBlurbs = Array.isArray(parsed.blurbs) ? parsed.blurbs : [];
  const blurbs: DialogueBlurb[] = [];
  let blurbIndex = 0;

  for (const item of rawBlurbs) {
    if (!item) continue;
    const japanese = String(item.japanese || item.text || item.original || '').trim();
    const translation = String(item.translation || item.english || '').trim();
    const notes = String(item.notes || item.explanation || item.subtleties || '').trim();

    if (japanese || translation) {
      blurbs.push({
        orderIndex: blurbIndex++,
        japanese,
        translation,
        notes: notes || 'No special nuance notes provided.',
      });
    }
  }

  return {
    individual,
    compounds: Object.values(compoundsMap),
    blurbs,
  };
}

export async function scanMangaImage(base64Image: string): Promise<ExtractedScanData> {
  const apiKey = await getApiKey();

  const body = {
    contents: [
      {
        parts: [
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: base64Image,
            },
          },
          {
            text: PROMPT_INSTRUCTIONS,
          },
        ],
      },
    ],
    generationConfig: {
      responseMimeType: 'application/json',
    },
  };

  const models = ['gemini-3.5-flash', 'gemini-3.1-flash-lite'];
  let lastError: any = null;

  for (const model of models) {
    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const response = await fetch(endpoint, {
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
      }
    } catch (err) {
      lastError = err;
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
    `Given Japanese text: "${text}".\n` +
    'Extract three categories:\n' +
    '1. "compounds": words containing kanji with compound reading in hiragana and concise english meaning\n' +
    '2. "kanji_in_order": individual kanji characters in exact order of appearance.\n' +
    '3. "blurbs": an array of dialogue or conjoined sentence units with "japanese", natural English "translation", and "notes" explaining nuances/subtleties.\n' +
    'Return valid JSON matching schema: {"compounds": [{"compound": "...", "reading": "...", "meaning": "..."}], "kanji_in_order": ["..."], "blurbs": [{"japanese": "...", "translation": "...", "notes": "..."}]}';

  const body = {
    contents: [
      {
        parts: [{ text: prompt }],
      },
    ],
    generationConfig: {
      responseMimeType: 'application/json',
    },
  };

  const models = ['gemini-3.5-flash', 'gemini-3.1-flash-lite'];
  for (const model of models) {
    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const response = await fetch(endpoint, {
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

  // Fallback if network fails: extract individual kanji via regex
  const individual = extractKanji(text);
  // Match contiguous kanji sequences as compounds
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
