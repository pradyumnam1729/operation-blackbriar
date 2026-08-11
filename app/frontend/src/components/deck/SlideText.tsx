import { useEffect, useRef, useState } from "react";

// Click-to-edit plain-text primitive for the slide canvas (blueprint §5.2).
// contentEditable bound to one slide field: plain-text paste only, Enter=new
// bullet in lists (via onEnter), Esc=revert, blur=commit. Slide fields are
// plain text by design (§0.1-2) — no markup ever enters the deck model.

interface SlideTextProps {
  value: string;
  editable: boolean;
  /** Shown in the empty region while editing; doubles as the aria-label. */
  placeholder: string;
  /** §1.1 hard server cap — a soft counter appears from 80% of it. */
  maxChars: number;
  /** Wrapper class carrying the layout styles (.ds-heading, .ds-subtitle, …). */
  className?: string;
  /** Lists: Enter hands the parent this item's text so it can commit it and
   *  insert a new item after it in ONE patch (avoids clobbering updates). */
  onEnter?: (text: string) => void;
  /** Lists: Backspace on an empty item removes it (focus moves to the previous). */
  onBackspaceEmpty?: () => void;
  /** Focus request from the parent (newly inserted bullet). */
  autoFocus?: boolean;
  onAutoFocus?: () => void;
  onCommit: (value: string) => void;
}

export function SlideText({
  value,
  editable,
  placeholder,
  maxChars,
  className,
  onEnter,
  onBackspaceEmpty,
  autoFocus,
  onAutoFocus,
  onCommit,
}: SlideTextProps) {
  const ref = useRef<HTMLDivElement>(null);
  const focusedRef = useRef(false);
  // null = not editing; number = live char count while focused.
  const [count, setCount] = useState<number | null>(null);

  // Keep the DOM text in sync with the model whenever the region is not being
  // edited (external updates: chat edits, rollback, layout switches).
  useEffect(() => {
    const el = ref.current;
    if (el && !focusedRef.current && (el.textContent ?? "") !== value) {
      el.textContent = value;
    }
  });

  useEffect(() => {
    if (!autoFocus || !editable) return;
    const el = ref.current;
    if (!el) return;
    el.focus();
    const sel = window.getSelection();
    if (sel) {
      const range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
    }
    onAutoFocus?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoFocus, editable]);

  const currentText = () => (ref.current?.textContent ?? "").replace(/\s+/g, " ").trim();

  const commit = () => onCommit(currentText());

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      if (ref.current) ref.current.textContent = value; // revert
      ref.current?.blur();
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      if (onEnter) {
        onEnter(currentText()); // parent commits + inserts in one patch
      } else {
        ref.current?.blur(); // single-field regions: Enter = commit
      }
      return;
    }
    if (e.key === "Backspace" && onBackspaceEmpty && currentText() === "") {
      e.preventDefault();
      onBackspaceEmpty();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    const text = e.clipboardData.getData("text/plain").replace(/\s+/g, " ");
    document.execCommand("insertText", false, text);
  };

  const showCounter = count !== null && maxChars > 0 && count >= Math.floor(maxChars * 0.8);

  return (
    <div className={className ? `ds-textwrap ${className}` : "ds-textwrap"}>
      <div
        ref={ref}
        className="ds-edit"
        contentEditable={editable}
        suppressContentEditableWarning
        spellCheck={false}
        role={editable ? "textbox" : undefined}
        aria-label={placeholder}
        data-placeholder={editable ? placeholder : undefined}
        onKeyDown={editable ? handleKeyDown : undefined}
        onPaste={editable ? handlePaste : undefined}
        onInput={
          editable ? () => setCount((ref.current?.textContent ?? "").length) : undefined
        }
        onFocus={
          editable
            ? () => {
                focusedRef.current = true;
                setCount((ref.current?.textContent ?? "").length);
              }
            : undefined
        }
        onBlur={
          editable
            ? () => {
                focusedRef.current = false;
                setCount(null);
                commit();
              }
            : undefined
        }
      />
      {showCounter && (
        <span className={count !== null && count > maxChars ? "ds-charcount over" : "ds-charcount"}>
          {count}/{maxChars}
        </span>
      )}
    </div>
  );
}
