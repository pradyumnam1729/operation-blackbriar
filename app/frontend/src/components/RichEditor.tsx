import { CSSProperties, useEffect, useReducer } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";

// TipTap wrapper — the editor works on rich HTML directly; markdown never
// appears anywhere in the authoring flow. Sanitization happens on the backend.

interface RichEditorProps {
  valueHtml: string;
  onChange: (html: string) => void;
  /** Hands the live editor instance to the parent (for AI selection actions). */
  onEditor?: (editor: Editor | null) => void;
}

// Hive toolbar buttons: quiet by default, white card + shadow when active
// (mirrors .tab-row button.active).
function toolbarBtn(active: boolean, disabled = false): CSSProperties {
  return {
    background: active ? "var(--bg-card)" : "transparent",
    color: disabled ? "var(--text-muted)" : active ? "var(--text-primary)" : "var(--text-secondary)",
    border: "none",
    padding: "7px 11px",
    fontSize: 13,
    fontWeight: active ? 500 : 400,
    cursor: disabled ? "default" : "pointer",
    lineHeight: 1.2,
    borderRadius: "var(--r-pill)",
    boxShadow: active ? "var(--shadow-1)" : "none",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  };
}

const PROSEMIRROR_CSS = `
.hive-editor .ProseMirror { outline: none; min-height: 320px; }
.hive-editor .ProseMirror h1 { font-size: 22px; font-weight: 600; margin-top: 0; }
.hive-editor .ProseMirror h2 { font-size: 17px; font-weight: 600; color: var(--teal-darkest); }
.hive-editor .ProseMirror h3 { font-size: 15px; font-weight: 600; }
.hive-editor .ProseMirror a { color: var(--teal-dark); }
.hive-editor .ProseMirror blockquote {
  border-left: 3px solid var(--teal-light);
  margin: 12px 0;
  padding: 6px 16px;
  background: #f2fafb;
  border-radius: 0 var(--r-sm) var(--r-sm) 0;
}
.hive-editor .ProseMirror ul, .hive-editor .ProseMirror ol { padding-left: 22px; }
.hive-editor .ProseMirror p { margin: 0 0 10px; }
`;

export function RichEditor({ valueHtml, onChange, onEditor }: RichEditorProps) {
  const [, bump] = useReducer((n: number) => n + 1, 0);

  const editor = useEditor({
    extensions: [StarterKit],
    content: valueHtml,
    editorProps: {
      attributes: {
        style: "outline: none; min-height: 320px; line-height: 1.65;",
      },
    },
    onUpdate: ({ editor: e }) => onChange(e.getHTML()),
  });

  // Re-render the toolbar on every transaction so active states track the caret.
  useEffect(() => {
    if (!editor) return;
    onEditor?.(editor);
    const rerender = () => bump();
    editor.on("transaction", rerender);
    return () => {
      editor.off("transaction", rerender);
      onEditor?.(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  // External value changes (load, AI replace, rollback) flow into the editor.
  useEffect(() => {
    if (editor && valueHtml !== editor.getHTML()) {
      editor.commands.setContent(valueHtml, { emitUpdate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valueHtml, editor]);

  if (!editor) return null;

  const heading = (level: 1 | 2 | 3) => (
    <button
      key={`h${level}`}
      type="button"
      style={toolbarBtn(editor.isActive("heading", { level }))}
      onClick={() => editor.chain().focus().toggleHeading({ level }).run()}
      title={`Heading ${level}`}
    >
      H{level}
    </button>
  );

  const divider = (
    <span style={{ width: 1, background: "var(--border-strong)", margin: "4px 4px", alignSelf: "stretch" }} />
  );

  return (
    <div className="hive-editor">
      <style>{PROSEMIRROR_CSS}</style>
      <div
        style={{
          display: "inline-flex",
          flexWrap: "wrap",
          gap: 2,
          padding: 4,
          borderRadius: 999,
          background: "var(--bg-page)",
          marginBottom: 12,
          alignItems: "center",
        }}
      >
        <button
          type="button"
          style={toolbarBtn(editor.isActive("paragraph"))}
          onClick={() => editor.chain().focus().setParagraph().run()}
          title="Paragraph"
        >
          P
        </button>
        {heading(1)}
        {heading(2)}
        {heading(3)}
        {divider}
        <button
          type="button"
          style={toolbarBtn(editor.isActive("bold"))}
          onClick={() => editor.chain().focus().toggleBold().run()}
          title="Bold"
        >
          <i className="fa-solid fa-bold" />
        </button>
        <button
          type="button"
          style={toolbarBtn(editor.isActive("italic"))}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          title="Italic"
        >
          <i className="fa-solid fa-italic" />
        </button>
        {divider}
        <button
          type="button"
          style={toolbarBtn(editor.isActive("bulletList"))}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          title="Bullet list"
        >
          <i className="fa-solid fa-list-ul" />
        </button>
        <button
          type="button"
          style={toolbarBtn(editor.isActive("orderedList"))}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          title="Ordered list"
        >
          <i className="fa-solid fa-list-ol" />
        </button>
        <button
          type="button"
          style={toolbarBtn(editor.isActive("blockquote"))}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          title="Blockquote"
        >
          <i className="fa-solid fa-quote-left" />
        </button>
        {divider}
        <button
          type="button"
          style={toolbarBtn(false, !editor.can().undo())}
          disabled={!editor.can().undo()}
          onClick={() => editor.chain().focus().undo().run()}
          title="Undo"
        >
          <i className="fa-solid fa-rotate-left" />
        </button>
        <button
          type="button"
          style={toolbarBtn(false, !editor.can().redo())}
          disabled={!editor.can().redo()}
          onClick={() => editor.chain().focus().redo().run()}
          title="Redo"
        >
          <i className="fa-solid fa-rotate-right" />
        </button>
      </div>
      <div
        style={{
          background: "#fff",
          border: "1px solid var(--border)",
          borderRadius: "var(--r-md)",
          minHeight: 320,
          padding: 16,
        }}
      >
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
