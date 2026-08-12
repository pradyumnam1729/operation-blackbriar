import puppeteer, { Browser } from "puppeteer";

// Server-side HTML -> PDF for finalized-asset downloads (studio blueprint):
// payloads are already complete, brand-styled HTML documents (or wrapped via
// wrapExportHtml for markdown) — Puppeteer just has to render them faithfully.

let browserPromise: Promise<Browser> | null = null;

function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = puppeteer.launch({ headless: true });
  }
  return browserPromise;
}

/** Render a complete HTML document to a PDF buffer, US Letter, backgrounds on. */
export async function renderHtmlToPdf(html: string): Promise<Buffer> {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setContent(html, { waitUntil: "load" });
    // Puppeteer can rasterize before an @import-loaded web font (Roboto)
    // finishes downloading/parsing, silently falling back to a system font.
    await page.evaluateHandle("document.fonts.ready");
    const pdf = await page.pdf({ format: "Letter", printBackground: true });
    return Buffer.from(pdf);
  } finally {
    await page.close();
  }
}
