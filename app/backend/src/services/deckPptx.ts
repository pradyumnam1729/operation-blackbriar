import PptxGenJS from "pptxgenjs";
import { DeckDoc, DeckSlide } from "./deck";
import { DECK_THEME } from "./deckTheme";

// Real .pptx export styled from AURIGO_PPT_TEMPLATE_2026.pptx theme constants
// (blueprint deck-studio.md §3.3 + §6.2). Pure: no model calls, no DB —
// DeckDoc in, Buffer out. Sharp corners everywhere: brand law.

const C = DECK_THEME.colors;
const FONT = DECK_THEME.fonts.pptx;
const W = DECK_THEME.slide.widthIn;
const H = DECK_THEME.slide.heightIn;

function wordmark(slide: PptxGenJS.Slide, color: string, centered = false) {
  slide.addText(DECK_THEME.wordmark.text, {
    x: centered ? 0 : W - 2.4,
    y: H - 0.62,
    w: centered ? W : 2.0,
    h: 0.4,
    align: centered ? "center" : "right",
    fontFace: FONT,
    fontSize: DECK_THEME.wordmark.sizePt,
    color,
    charSpacing: DECK_THEME.wordmark.charSpacingPt,
    bold: true,
  });
}

function accentBar(slide: PptxGenJS.Slide) {
  slide.addShape("rect", { x: 0.9, y: 1.1, w: 0.9, h: 0.07, fill: { color: C.red }, line: { type: "none" } });
}

function lightHeader(slide: PptxGenJS.Slide, title: string) {
  accentBar(slide);
  slide.addText(title, {
    x: 0.9,
    y: 1.3,
    w: 11.5,
    h: 0.9,
    fontFace: FONT,
    fontSize: 26,
    bold: true,
    color: C.tealDark,
    align: "left",
  });
}

function addTitle(pptx: PptxGenJS, s: DeckSlide, kicker: string | null) {
  const slide = pptx.addSlide();
  slide.background = { color: C.tealDark };
  if (kicker) {
    slide.addText(kicker.toUpperCase(), {
      x: 0.9, y: 2.2, w: 11.5, h: 0.4,
      fontFace: FONT, fontSize: 13, color: C.tealLight, charSpacing: 3, bold: true,
    });
  }
  slide.addText(s.title, {
    x: 0.9, y: 2.7, w: 11.5, h: 1.7,
    fontFace: FONT, fontSize: 36, bold: true, color: C.white, valign: "top",
  });
  if (s.subtitle) {
    slide.addText(s.subtitle, {
      x: 0.9, y: 4.6, w: 11.0, h: 0.9,
      fontFace: FONT, fontSize: 16, color: C.mist,
    });
  }
  wordmark(slide, C.tealLight);
  return slide;
}

function addAgenda(pptx: PptxGenJS, s: DeckSlide) {
  const slide = pptx.addSlide();
  slide.background = { color: C.white };
  lightHeader(slide, s.title);
  const items = (s.body ?? []).map((item, i) => ({
    text: `${i + 1}.  ${item}`,
    options: { fontFace: FONT, fontSize: 16, color: C.charcoal, breakLine: true, lineSpacingMultiple: 1.5 },
  }));
  slide.addText(items, { x: 0.9, y: 2.4, w: 11.5, h: 4.4, valign: "top" });
  wordmark(slide, C.tealDark);
  return slide;
}

function addSection(pptx: PptxGenJS, s: DeckSlide) {
  const slide = pptx.addSlide();
  slide.background = { color: C.ink };
  slide.addText(s.title, {
    x: 1.2, y: 2.9, w: 11.0, h: 1.2,
    fontFace: FONT, fontSize: 32, bold: true, color: C.white,
  });
  if (s.subtitle) {
    slide.addText(s.subtitle, {
      x: 1.2, y: 4.1, w: 10.5, h: 0.7,
      fontFace: FONT, fontSize: 15, color: C.tealLight,
    });
  }
  wordmark(slide, C.tealLight);
  return slide;
}

function addBullets(pptx: PptxGenJS, s: DeckSlide) {
  const slide = pptx.addSlide();
  slide.background = { color: C.white };
  lightHeader(slide, s.title);
  const items = (s.body ?? []).map((item) => ({
    text: item,
    options: {
      fontFace: FONT, fontSize: 15, color: C.charcoal,
      bullet: { characterCode: "2013", indent: 18 },
      breakLine: true, lineSpacingMultiple: 1.4,
    },
  }));
  slide.addText(items, { x: 0.9, y: 2.4, w: 11.5, h: 4.5, valign: "top" });
  wordmark(slide, C.tealDark);
  return slide;
}

function addTwoColumn(pptx: PptxGenJS, s: DeckSlide) {
  const slide = pptx.addSlide();
  slide.background = { color: C.white };
  lightHeader(slide, s.title);
  const colW = 5.55;
  const colY = 2.3;
  const colH = 3.9;
  (s.columns ?? []).forEach((col, i) => {
    const x = 0.9 + i * (colW + 0.4);
    slide.addShape("rect", { x, y: colY, w: colW, h: colH, fill: { color: C.mist }, line: { type: "none" } });
    slide.addShape("rect", { x, y: colY, w: colW, h: 0.06, fill: { color: C.tealDark }, line: { type: "none" } });
    slide.addText(col.heading, {
      x: x + 0.25, y: colY + 0.25, w: colW - 0.5, h: 0.5,
      fontFace: FONT, fontSize: 16, bold: true, color: C.tealDark,
    });
    const items = col.items.map((item) => ({
      text: item,
      options: {
        fontFace: FONT, fontSize: 13, color: C.charcoal,
        bullet: { characterCode: "2013", indent: 14 },
        breakLine: true, lineSpacingMultiple: 1.3,
      },
    }));
    slide.addText(items, { x: x + 0.25, y: colY + 0.9, w: colW - 0.5, h: colH - 1.1, valign: "top" });
  });
  wordmark(slide, C.tealDark);
  return slide;
}

function addQuote(pptx: PptxGenJS, s: DeckSlide) {
  const slide = pptx.addSlide();
  slide.background = { color: C.tealDark };
  slide.addText("PROOF", {
    x: 0.9, y: 1.4, w: 6, h: 0.4,
    fontFace: FONT, fontSize: 13, color: C.tealLight, charSpacing: 3, bold: true,
  });
  slide.addText(`“${s.quote?.text ?? s.title}”`, {
    x: 1.6, y: 2.4, w: 10, h: 2.6,
    fontFace: FONT, fontSize: 22, italic: true, color: C.white, valign: "middle",
  });
  if (s.quote?.attribution) {
    slide.addText(`— ${s.quote.attribution}`, {
      x: 1.6, y: 5.2, w: 10, h: 0.5,
      fontFace: FONT, fontSize: 13, color: C.tealLight,
    });
  }
  wordmark(slide, C.tealLight);
  return slide;
}

function addClosing(pptx: PptxGenJS, s: DeckSlide) {
  const slide = pptx.addSlide();
  slide.background = { color: C.ink };
  slide.addText("NEXT STEP", {
    x: 0.9, y: 2.0, w: 11.5, h: 0.4, align: "center",
    fontFace: FONT, fontSize: 13, color: C.tealLight, charSpacing: 3, bold: true,
  });
  slide.addText(s.title, {
    x: 0.9, y: 2.6, w: 11.5, h: 1.2, align: "center",
    fontFace: FONT, fontSize: 32, bold: true, color: C.white,
  });
  if (s.subtitle) {
    slide.addText(s.subtitle, {
      x: 1.9, y: 3.9, w: 9.5, h: 0.9, align: "center",
      fontFace: FONT, fontSize: 16, color: C.mist,
    });
  }
  wordmark(slide, C.tealLight, true);
  return slide;
}

export async function buildDeckPptx(
  deck: DeckDoc,
  title: string,
  productName: string | null = null
): Promise<Buffer> {
  const pptx = new PptxGenJS();
  pptx.layout = DECK_THEME.slide.pptxLayout;
  pptx.title = title;

  for (const s of deck.slides) {
    let slide: PptxGenJS.Slide;
    switch (s.layout) {
      case "title":
        // Kicker mirrors the web canvas: product/context line, always shown.
        slide = addTitle(pptx, s, productName ?? "Aurigo");
        break;
      case "agenda":
        slide = addAgenda(pptx, s);
        break;
      case "section":
        slide = addSection(pptx, s);
        break;
      case "two-column":
        slide = addTwoColumn(pptx, s);
        break;
      case "quote":
        slide = addQuote(pptx, s);
        break;
      case "closing":
        slide = addClosing(pptx, s);
        break;
      default:
        slide = addBullets(pptx, s);
    }
    if (s.notes) slide.addNotes(s.notes);
  }

  const out = await pptx.write({ outputType: "nodebuffer" });
  return out as Buffer;
}
