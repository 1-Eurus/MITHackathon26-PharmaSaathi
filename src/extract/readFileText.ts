import * as pdfjsLib from "pdfjs-dist";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).href;

/** read raw text out of an uploaded invoice file - free, entirely client-side.
 *  Images and scanned (image-only) PDF pages go through OCR (tesseract.js,
 *  downloads its language model from a CDN on first use, then caches it);
 *  a text-layer PDF is read directly, no OCR needed. */
export async function readFileAsText(file: File, onProgress?: (msg: string) => void): Promise<string> {
  if (file.type === "application/pdf") return readPdfText(file, onProgress);
  return ocrImage(file, onProgress);
}

async function readPdfText(file: File, onProgress?: (msg: string) => void): Promise<string> {
  onProgress?.("Reading PDF…");
  const buf = await file.arrayBuffer();
  const doc = await pdfjsLib.getDocument({ data: buf }).promise;
  let text = "";
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map((it) => ("str" in it ? it.str : "")).join(" ") + "\n";
  }
  if (text.trim().length > 20) return text;

  // no embedded text layer (a scanned invoice saved as PDF) - rasterize the
  // first page and OCR it instead
  onProgress?.("No embedded text found — running OCR on page 1…");
  const page = await doc.getPage(1);
  const viewport = page.getViewport({ scale: 2 });
  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext("2d")!;
  await page.render({ canvasContext: ctx, viewport, canvas }).promise;
  return ocrCanvas(canvas, onProgress);
}

async function ocrImage(file: File, onProgress?: (msg: string) => void): Promise<string> {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng", 1, { logger: (m) => reportProgress(m, onProgress) });
  try {
    const { data } = await worker.recognize(file);
    return data.text;
  } finally {
    await worker.terminate();
  }
}

async function ocrCanvas(canvas: HTMLCanvasElement, onProgress?: (msg: string) => void): Promise<string> {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng", 1, { logger: (m) => reportProgress(m, onProgress) });
  try {
    const { data } = await worker.recognize(canvas);
    return data.text;
  } finally {
    await worker.terminate();
  }
}

function reportProgress(m: { status: string; progress: number }, onProgress?: (msg: string) => void): void {
  if (!onProgress) return;
  onProgress(`${m.status}${m.progress ? ` ${Math.round(m.progress * 100)}%` : ""}…`);
}
