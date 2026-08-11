import { useEffect, useRef, useState } from "react";
import { DECK_CAPS, DeckSlide, SlideColumn } from "../../lib/api";
import { SlideText } from "./SlideText";

// The slide surface (blueprint §5.2, §6.2). SlideStage renders one slide on a
// fixed 1280×720 design grid mirroring the pptx masters; SlideCanvas scales the
// stage to its container (16:9 via aspect-ratio CSS). The thumbnail rail reuses
// SlideStage under a fixed transform: scale.

export interface SlideStageProps {
  slide: DeckSlide;
  editable: boolean;
  /** Title-slide context line (product name) — presentation only, not a slide field. */
  kicker?: string | null;
  onPatch?: (patch: Partial<DeckSlide>) => void;
}

const EMPTY_COLUMNS: [SlideColumn, SlideColumn] = [
  { heading: "", items: [] },
  { heading: "", items: [] },
];

export function SlideStage({ slide, editable, kicker, onPatch }: SlideStageProps) {
  // Focus request for a just-inserted list item ("b2" body / "c1-0" column item).
  const [pendingFocus, setPendingFocus] = useState<string | null>(null);

  const patch = (p: Partial<DeckSlide>) => onPatch?.(p);

  // ---- field bindings ----
  const heading = (placeholder: string) => (
    <SlideText
      className="ds-heading"
      value={slide.title}
      editable={editable}
      placeholder={placeholder}
      maxChars={DECK_CAPS.title}
      onCommit={(v) => patch({ title: v })}
    />
  );

  const subtitle = (placeholder: string) => (
    <SlideText
      className="ds-subtitle"
      value={slide.subtitle ?? ""}
      editable={editable}
      placeholder={placeholder}
      maxChars={DECK_CAPS.subtitle}
      onCommit={(v) => patch({ subtitle: v === "" ? undefined : v })}
    />
  );

  // ---- list bindings (body: agenda | content-bullets) ----
  const items = slide.body ?? [];

  const listItem = (i: number, placeholder: string) => (
    <SlideText
      value={items[i] ?? ""}
      editable={editable}
      placeholder={placeholder}
      maxChars={DECK_CAPS.bullet}
      autoFocus={pendingFocus === `b${i}`}
      onAutoFocus={() => setPendingFocus(null)}
      onCommit={(v) => patch({ body: items.map((x, j) => (j === i ? v : x)) })}
      onEnter={
        items.length < DECK_CAPS.bulletsPerSlide
          ? (text) => {
              const next = [...items.slice(0, i), text, "", ...items.slice(i + 1)];
              patch({ body: next });
              setPendingFocus(`b${i + 1}`);
            }
          : undefined
      }
      onBackspaceEmpty={
        items.length > 1
          ? () => {
              patch({ body: items.filter((_, j) => j !== i) });
              if (i > 0) setPendingFocus(`b${i - 1}`);
            }
          : undefined
      }
    />
  );

  // Empty body while editing: a ghost line so the canvas never sits empty white (§7).
  const ghostItem = (placeholder: string) => (
    <SlideText
      value=""
      editable={editable}
      placeholder={placeholder}
      maxChars={DECK_CAPS.bullet}
      onCommit={(v) => {
        if (v !== "") patch({ body: [v] });
      }}
      onEnter={(text) => {
        patch({ body: [text, ""] });
        setPendingFocus("b1");
      }}
    />
  );

  // ---- two-column bindings ----
  const columns = slide.columns ?? EMPTY_COLUMNS;

  const patchColumn = (ci: 0 | 1, col: SlideColumn) => {
    const next: [SlideColumn, SlideColumn] =
      ci === 0 ? [col, columns[1]] : [columns[0], col];
    patch({ columns: next });
  };

  const columnCard = (ci: 0 | 1) => {
    const col = columns[ci];
    const colItems = col.items;
    return (
      <div className="ds-column" key={ci}>
        <SlideText
          className="ds-column-heading"
          value={col.heading}
          editable={editable}
          placeholder={ci === 0 ? "Left column heading" : "Right column heading"}
          maxChars={DECK_CAPS.columnHeading}
          onCommit={(v) => patchColumn(ci, { ...col, heading: v })}
        />
        <ul className="ds-column-items">
          {colItems.map((_, i) => (
            <li className="ds-column-item" key={i}>
              <SlideText
                value={colItems[i] ?? ""}
                editable={editable}
                placeholder="Point"
                maxChars={DECK_CAPS.columnItem}
                autoFocus={pendingFocus === `c${ci}-${i}`}
                onAutoFocus={() => setPendingFocus(null)}
                onCommit={(v) =>
                  patchColumn(ci, { ...col, items: colItems.map((x, j) => (j === i ? v : x)) })
                }
                onEnter={(text) => {
                  patchColumn(ci, {
                    ...col,
                    items: [...colItems.slice(0, i), text, "", ...colItems.slice(i + 1)],
                  });
                  setPendingFocus(`c${ci}-${i + 1}`);
                }}
                onBackspaceEmpty={
                  colItems.length > 1
                    ? () => {
                        patchColumn(ci, { ...col, items: colItems.filter((_, j) => j !== i) });
                        if (i > 0) setPendingFocus(`c${ci}-${i - 1}`);
                      }
                    : undefined
                }
              />
            </li>
          ))}
          {colItems.length === 0 && (
            <li className="ds-column-item">
              <SlideText
                value=""
                editable={editable}
                placeholder="Add a point — Enter for the next"
                maxChars={DECK_CAPS.columnItem}
                onCommit={(v) => {
                  if (v !== "") patchColumn(ci, { ...col, items: [v] });
                }}
                onEnter={(text) => {
                  patchColumn(ci, { ...col, items: [text, ""] });
                  setPendingFocus(`c${ci}-1`);
                }}
              />
            </li>
          )}
        </ul>
      </div>
    );
  };

  // ---- quote bindings ----
  const quote = slide.quote ?? { text: "", attribution: "" };

  // Template top-right chrome (red bar + white Aurigo logo) on dark slides.
  const templateMark = (
    <span className="ds-template-mark" aria-hidden>
      <img src="/deck-theme/logo-white.png" alt="" />
    </span>
  );

  switch (slide.layout) {
    case "title":
      return (
        <div className="deck-stage layout-title">
          {templateMark}
          <span className="ds-kicker">{(kicker ?? "Aurigo").toUpperCase()}</span>
          {heading("Deck title")}
          {subtitle("Subtitle — audience and promise in one line")}
        </div>
      );

    case "agenda":
      return (
        <div className="deck-stage layout-agenda">
          <span className="ds-accent-bar" />
          {heading("Agenda")}
          <ol className="ds-agenda-list">
            {items.map((_, i) => (
              <li className="ds-agenda-item" key={i}>
                <span className="ds-agenda-num">{i + 1}.</span>
                {listItem(i, "Agenda item")}
              </li>
            ))}
            {items.length === 0 && (
              <li className="ds-agenda-item">
                <span className="ds-agenda-num">1.</span>
                {ghostItem("Add an agenda item — Enter for the next")}
              </li>
            )}
          </ol>
        </div>
      );

    case "section":
      return (
        <div className="deck-stage layout-section">
          {templateMark}
          {heading("Section title")}
          {subtitle("One line on what this section proves")}
        </div>
      );

    case "two-column":
      return (
        <div className="deck-stage layout-two-column">
          <span className="ds-accent-bar" />
          {heading("Slide headline")}
          <div className="ds-columns">
            {columnCard(0)}
            {columnCard(1)}
          </div>
        </div>
      );

    case "quote":
      return (
        <div className="deck-stage layout-quote">
          {templateMark}
          <span className="ds-kicker">PROOF</span>
          <SlideText
            className="ds-quote-text"
            value={quote.text}
            editable={editable}
            placeholder="Customer quote or quantified proof point"
            maxChars={DECK_CAPS.quoteText}
            onCommit={(v) => patch({ quote: { ...quote, text: v } })}
          />
          <div className="ds-attribution">
            <span>&mdash;</span>
            <SlideText
              value={quote.attribution}
              editable={editable}
              placeholder="Name, title, agency"
              maxChars={DECK_CAPS.quoteAttribution}
              onCommit={(v) => patch({ quote: { ...quote, attribution: v } })}
            />
          </div>
        </div>
      );

    case "closing":
      return (
        <div className="deck-stage layout-closing">
          <span className="ds-kicker">NEXT STEP</span>
          {heading("The advance you are asking for")}
          {subtitle("Make the next step concrete and easy to say yes to")}
          {templateMark}
          <span className="ds-wordmark on-dark">AURIGO</span>
        </div>
      );

    case "content-bullets":
    default:
      return (
        <div className="deck-stage layout-content-bullets">
          <span className="ds-accent-bar" />
          {heading("Slide headline")}
          <ul className="ds-bullets">
            {items.map((_, i) => (
              <li className="ds-bullet" key={i}>
                {listItem(i, "Point")}
              </li>
            ))}
            {items.length === 0 && (
              <li className="ds-bullet">{ghostItem("Add a point — Enter for the next")}</li>
            )}
          </ul>
          <span className="ds-wordmark">AURIGO</span>
        </div>
      );
  }
}

/** 16:9 canvas — measures its container and scales the fixed stage to fit. */
export function SlideCanvas(props: SlideStageProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => setScale(el.clientWidth / 1280);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={wrapRef} className="deck-canvas-wrap">
      {scale > 0 && (
        <div className="deck-stage-holder" style={{ transform: `scale(${scale})` }}>
          <SlideStage {...props} />
        </div>
      )}
    </div>
  );
}
