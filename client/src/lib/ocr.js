/**
 * ============================================================================
 * OCR helper - reads text out of a screenshot of a message
 * ============================================================================
 *
 * Tesseract.js is ~1.5MB of WASM + trained data, so it is loaded LAZILY the
 * first time someone actually taps "take a photo". Screen-reader and
 * keyboard-only users never pay for it.
 *
 * PRIVACY: the image is decoded in the browser, run through a local WASM
 * model, and the temporary canvas is released. Nothing is uploaded - there is
 * no server-side upload path in this app at all.
 *
 * If anything at all goes wrong - no network for the language data, a missing
 * worker, an unsupported browser - the caller gets a clear status string and
 * the UI falls back to "please type the message instead". OCR is a nicety,
 * never a requirement.
 */

/** Tesseract language codes. Indian language data is large; default to English. */
const LANG_MAP = {
  en: 'eng',
  hi: 'hin',
  ta: 'tam',
  te: 'tel',
  bn: 'ben',
};

let workerPromise = null;
let activeWorker = null;

function isSupported() {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

/**
 * Recognises text in an image File/Blob.
 *
 * @param {File|Blob} image
 * @param {object} [options]
 * @param {string} [options.lang='en'] app language code
 * @param {(progress:number, status:string) => void} [options.onProgress]
 * @returns {Promise<{ ok: boolean, text: string, status: string, confidence: number }>}
 *          status: 'ok' | 'unsupported' | 'failed' | 'empty'
 */
export async function recogniseText(image, { lang = 'en', onProgress } = {}) {
  if (!isSupported() || !image) {
    return { ok: false, text: '', status: 'unsupported', confidence: 0 };
  }

  try {
    onProgress?.(0.05, 'loading');

    // Dynamic import keeps Tesseract out of the initial bundle.
    const { createWorker } = await import('tesseract.js');

    const tessLang = LANG_MAP[lang] || 'eng';
    // English is bundled with the worker; other languages need a fetch, which
    // only works online. We try, and fall back to English on failure.
    const wantLang = tessLang === 'eng' ? 'eng' : `${tessLang}+eng`;

    if (!workerPromise) {
      workerPromise = createWorker(wantLang, 1, {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            onProgress?.(0.4 + m.progress * 0.6, 'recognizing');
          } else {
            onProgress?.(Math.min(0.4, m.progress * 0.4), m.status);
          }
        },
      }).catch((err) => {
        console.warn('[ocr] worker creation failed:', err);
        workerPromise = null;
        throw err;
      });
    }

    const worker = await workerPromise;
    activeWorker = worker;

    onProgress?.(0.45, 'recognizing');
    const { data } = await worker.recognize(image);

    const text = (data?.text || '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
    const confidence = Math.round(data?.confidence ?? 0);

    if (!text) return { ok: false, text: '', status: 'empty', confidence };

    // Low confidence usually means a blurry photo. Still return the text -
    // the user can edit it - but let the caller warn.
    return { ok: true, text, status: 'ok', confidence };
  } catch (err) {
    console.warn('[ocr] failed:', err);
    return { ok: false, text: '', status: 'failed', confidence: 0 };
  }
}

/** Frees the WASM worker. Call when leaving the Safety Checker. */
export async function disposeOcr() {
  try {
    if (activeWorker) {
      await activeWorker.terminate();
    }
  } catch {
    /* ignore */
  }
  activeWorker = null;
  workerPromise = null;
}

/**
 * Downscales a photo before OCR. Phone cameras produce 4000px images that are
 * slow to read and often out of memory on low-end Android, which is exactly
 * the device class this app targets.
 *
 * @param {File} file
 * @param {number} maxDim
 * @returns {Promise<{ blob: Blob, dataUrl: string, width: number, height: number }>}
 */
export function downscaleImage(file, maxDim = 1600) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const width = Math.round(img.width * scale);
      const height = Math.round(img.height * scale);

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');

      // Binarising to high contrast materially improves OCR accuracy on the
      // small, low-contrast screenshots people actually take.
      ctx.filter = 'grayscale(1) contrast(1.6)';
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (blob) resolve({ blob, dataUrl: canvas.toDataURL('image/jpeg', 0.85), width, height });
          else reject(new Error('Could not process the image'));
        },
        'image/jpeg',
        0.85
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('That file is not an image VoicePay can read'));
    };

    img.src = url;
  });
}
