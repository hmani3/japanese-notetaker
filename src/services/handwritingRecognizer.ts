/**
 * Service to recognize handwritten Japanese Kanji characters from stroke coordinates.
 * Uses Google's handwriting input API for sub-100ms accuracy.
 */

export interface Point {
  x: number;
  y: number;
}

export type Stroke = Point[];

export async function recognizeKanjiDrawing(
  strokes: Stroke[],
  canvasSize: number = 280
): Promise<string[]> {
  if (strokes.length === 0) return [];

  const scale = 300 / canvasSize;
  const ink = strokes.map((stroke) => {
    const xs: number[] = [];
    const ys: number[] = [];
    const ts: number[] = [];
    stroke.forEach((pt, idx) => {
      xs.push(Math.round(pt.x * scale));
      ys.push(Math.round(pt.y * scale));
      ts.push(idx * 20);
    });
    return [xs, ys, ts];
  });

  const payload = {
    options: 'enable_pre_space',
    requests: [
      {
        writing_guide: { writing_width: 300, writing_height: 300 },
        ink,
      },
    ],
  };

  try {
    const response = await fetch(
      'https://inputtools.google.com/request?itc=ja-t-i0-handwrit&app=demopage',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      }
    );

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    if (data && data[0] === 'SUCCESS' && Array.isArray(data[1]) && data[1][0]) {
      const rawCandidates: string[] = data[1][0][1] || [];
      const kanjiRegex = /[\u4E00-\u9FAF\u3400-\u4DBF\uF900-\uFAFF]/;
      const kanjiCandidates: string[] = [];

      for (const item of rawCandidates) {
        for (const char of item) {
          if (kanjiRegex.test(char) && !kanjiCandidates.includes(char)) {
            kanjiCandidates.push(char);
          }
        }
      }

      return kanjiCandidates;
    }

    return [];
  } catch {
    return [];
  }
}
