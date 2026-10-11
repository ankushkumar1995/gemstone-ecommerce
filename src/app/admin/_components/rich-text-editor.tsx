"use client";

/**
 * RichTextEditor — a Tiptap-powered WYSIWYG editor for article content.
 * Outputs HTML. Toolbar: bold / italic / underline / strike, H2 / H3,
 * bullet & ordered lists, blockquote, link, and image (from the Media Library).
 */

import { useState, useCallback } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Link as LinkIcon,
  Image as ImageIcon,
  Undo2,
  Redo2,
  Minus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { MediaPickerModal } from "./media-picker";

export function RichTextEditor({
  value,
  onChange,
  placeholder = "Write your article…",
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);

  const editor = useEditor({
    immediatelyRender: false, // required for Next.js SSR
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      Image.configure({ HTMLAttributes: { class: "rounded-xl my-4" } }),
      Link.configure({ openOnClick: false, HTMLAttributes: { rel: "noopener noreferrer" } }),
    ],
    content: value || "",
    editorProps: {
      attributes: {
        class:
          "prose-admin min-h-[320px] max-w-none px-4 py-3 outline-none text-sm leading-relaxed",
      },
    },
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  const addImage = useCallback(
    (url: string) => {
      if (url) editor?.chain().focus().setImage({ src: url }).run();
    },
    [editor]
  );

  const setLink = useCallback(() => {
    if (!editor) return;
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Link URL", prev ?? "https://");
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }, [editor]);

  if (!editor) {
    return (
      <div className="rounded-lg border" style={{ borderColor: "var(--a-border)" }}>
        <div className="h-[380px] animate-pulse rounded-lg" style={{ background: "var(--a-surface-2)" }} />
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border" style={{ borderColor: "var(--a-border)" }}>
      {/* toolbar */}
      <div
        className="flex flex-wrap items-center gap-0.5 border-b p-1.5"
        style={{ borderColor: "var(--a-border)", background: "var(--a-surface-2)" }}
      >
        <Btn editor={editor} active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()} label="Bold">
          <Bold size={15} />
        </Btn>
        <Btn editor={editor} active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()} label="Italic">
          <Italic size={15} />
        </Btn>
        <Btn editor={editor} active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()} label="Underline">
          <UnderlineIcon size={15} />
        </Btn>
        <Btn editor={editor} active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()} label="Strikethrough">
          <Strikethrough size={15} />
        </Btn>

        <Divider />

        <Btn editor={editor} active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} label="Heading 2">
          <Heading2 size={15} />
        </Btn>
        <Btn editor={editor} active={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} label="Heading 3">
          <Heading3 size={15} />
        </Btn>

        <Divider />

        <Btn editor={editor} active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()} label="Bullet list">
          <List size={15} />
        </Btn>
        <Btn editor={editor} active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()} label="Numbered list">
          <ListOrdered size={15} />
        </Btn>
        <Btn editor={editor} active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()} label="Quote">
          <Quote size={15} />
        </Btn>
        <Btn editor={editor} active={false} onClick={() => editor.chain().focus().setHorizontalRule().run()} label="Divider">
          <Minus size={15} />
        </Btn>

        <Divider />

        <Btn editor={editor} active={editor.isActive("link")} onClick={setLink} label="Link">
          <LinkIcon size={15} />
        </Btn>
        <Btn editor={editor} active={false} onClick={() => setPickerOpen(true)} label="Insert image">
          <ImageIcon size={15} />
        </Btn>

        <Divider />

        <Btn editor={editor} active={false} disabled={!editor.can().undo()} onClick={() => editor.chain().focus().undo().run()} label="Undo">
          <Undo2 size={15} />
        </Btn>
        <Btn editor={editor} active={false} disabled={!editor.can().redo()} onClick={() => editor.chain().focus().redo().run()} label="Redo">
          <Redo2 size={15} />
        </Btn>
      </div>

      {/* editable area */}
      <div style={{ background: "var(--a-surface)", color: "var(--a-fg)" }}>
        {editor.isEmpty && (
          <p className="pointer-events-none absolute px-4 py-3 text-sm" style={{ color: "var(--a-faint)" }}>
            {placeholder}
          </p>
        )}
        <EditorContent editor={editor} />
      </div>

      <MediaPickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onConfirm={(urls) => urls.forEach((u) => addImage(u))}
      />
    </div>
  );
}

function Btn({
  editor,
  active,
  disabled,
  onClick,
  label,
  children,
}: {
  editor: Editor;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      aria-pressed={active}
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded-md transition-colors disabled:opacity-30",
        active ? "text-[var(--a-gold)]" : "hover:bg-black/[0.06]"
      )}
      style={{
        background: active ? "var(--a-gold-soft)" : undefined,
        color: active ? "var(--a-gold)" : "var(--a-fg)",
      }}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <span className="mx-1 h-5 w-px" style={{ background: "var(--a-border)" }} />;
}
