import { DeckSlide } from "../../lib/api";
import { SlideStage } from "./SlideCanvas";

// Left thumbnail rail (blueprint §5.2): each thumb is the real SlideStage under
// a fixed transform: scale — pixel-identical to the canvas. Click to select,
// active ring, slide numbers, amber dot on slides with guard hits.

interface SlideThumbRailProps {
  slides: DeckSlide[];
  active: number;
  onSelect: (index: number) => void;
  /** Slide ids carrying forbidden-word hits from the last guard result. */
  guardSlideIds?: Set<string>;
  /** Title-slide context line, mirrored from the canvas. */
  kicker?: string | null;
}

export function SlideThumbRail({
  slides,
  active,
  onSelect,
  guardSlideIds,
  kicker,
}: SlideThumbRailProps) {
  return (
    <div className="deck-rail" role="listbox" aria-label="Slides">
      {slides.map((slide, i) => (
        <button
          key={slide.id}
          type="button"
          className={i === active ? "deck-thumb active" : "deck-thumb"}
          role="option"
          aria-selected={i === active}
          aria-label={`Slide ${i + 1}: ${slide.title || slide.layout}`}
          title={slide.title || `Slide ${i + 1}`}
          onClick={() => onSelect(i)}
        >
          <span className="deck-thumb-scale" aria-hidden>
            <SlideStage slide={slide} editable={false} kicker={kicker} />
          </span>
          <span className="deck-thumb-num">{i + 1}</span>
          {guardSlideIds?.has(slide.id) && (
            <span
              className="deck-thumb-dot"
              title="Contains banned words — will block finalization"
            />
          )}
        </button>
      ))}
    </div>
  );
}
