/**
 * Nural+ Extractor — Tesseract OCR Provider
 *
 * Implements the `OcrProvider` interface using Tesseract.js for
 * real text recognition from images, entirely in Node.js.
 *
 * Designed for serverless compatibility:
 * - Creates a fresh worker per call and terminates after use
 * - Uses explicit CDN paths for WASM core and language data
 *   (avoids writing to the ephemeral filesystem)
 * - Graceful error handling with fallback message
 */

import { createWorker } from "tesseract.js";
import type { OcrProvider } from "../types";

export class TesseractOcrProvider implements OcrProvider {
    private lang: string;

    /**
     * @param lang  Tesseract language code(s), e.g. "eng", "fra", "eng+fra"
     */
    constructor(lang = "eng") {
        this.lang = lang;
    }

    async recognize(imageBuffer: Buffer): Promise<string> {
        let worker: Awaited<ReturnType<typeof createWorker>> | null = null;

        try {
            // Create a dedicated worker for this recognition pass.
            // In serverless, workers are short-lived — we terminate after each call
            // to avoid resource leaks between invocations.
            worker = await createWorker(this.lang, undefined, {
                // Use CDN-hosted resources so nothing needs to be written to disk
                cachePath: "/tmp",
                logger: () => { }, // silence progress logs
            });

            const {
                data: { text },
            } = await worker.recognize(imageBuffer);

            return text.trim();
        } catch (err: unknown) {
            const message =
                err instanceof Error ? err.message : "Unknown OCR error";
            console.error(`[TesseractOcrProvider] OCR failed: ${message}`);
            return `[OCR Error] Could not extract text: ${message}`;
        } finally {
            // Always terminate the worker to free memory
            if (worker) {
                try {
                    await worker.terminate();
                } catch {
                    // Swallow termination errors
                }
            }
        }
    }
}
