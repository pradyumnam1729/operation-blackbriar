import test from "node:test";
import assert from "node:assert/strict";
import AdmZip from "adm-zip";
import { DeckDoc } from "../src/services/deck";
import { buildDeckPptx } from "../src/services/deckPptx";
import { DECK_THEME } from "../src/services/deckTheme";

const FIXTURE: DeckDoc = {
  schema: 1,
  theme: "aurigo-2026",
  slides: [
    { id: "s1", layout: "title", title: "Fixture Deck", subtitle: "Masterworks" },
    { id: "s2", layout: "agenda", title: "Agenda", body: ["First", "Second"] },
    { id: "s3", layout: "section", title: "Part one" },
    { id: "s4", layout: "content-bullets", title: "Bullets", body: ["a", "b"], notes: "note here" },
    {
      id: "s5",
      layout: "two-column",
      title: "Columns",
      columns: [
        { heading: "L", items: ["x"] },
        { heading: "R", items: ["y"] },
      ],
    },
    { id: "s6", layout: "quote", title: "Proof", quote: { text: "Quote", attribution: "Attr" } },
    { id: "s7", layout: "closing", title: "Close", subtitle: "Do the thing" },
  ],
};

test("buildDeckPptx produces a valid pptx with one slide per DeckSlide", async () => {
  const buffer = await buildDeckPptx(FIXTURE, "Fixture Deck", "Masterworks AI");
  assert.ok(buffer.length > 1000);
  const zip = new AdmZip(buffer);
  const slideEntries = zip
    .getEntries()
    .filter((e) => /^ppt\/slides\/slide\d+\.xml$/.test(e.entryName));
  assert.equal(slideEntries.length, FIXTURE.slides.length);

  // Palette fidelity: every srgbClr in the slide XML must come from the theme
  // (plus pure black/white text defaults pptxgenjs may emit).
  const allowed = new Set<string>([...Object.values(DECK_THEME.colors), "000000", "FFFFFF"]);
  for (const entry of slideEntries) {
    const xml = entry.getData().toString("utf8");
    for (const m of xml.matchAll(/<a:srgbClr val="([0-9A-Fa-f]{6})"/g)) {
      assert.ok(allowed.has(m[1].toUpperCase()), `off-palette color ${m[1]} in ${entry.entryName}`);
    }
  }

  // Speaker notes made it into the file.
  const notes = zip
    .getEntries()
    .filter((e) => /^ppt\/notesSlides\/notesSlide\d+\.xml$/.test(e.entryName))
    .map((e) => e.getData().toString("utf8"))
    .join("");
  assert.match(notes, /note here/);
});
