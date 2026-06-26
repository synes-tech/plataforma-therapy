import { useEffect, useRef } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from '@tiptap/markdown';
import Placeholder from '@tiptap/extension-placeholder';
import './wysiwyg-editor.css';

interface ToolbarButtonProps {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

function ToolbarButton({ label, active, disabled, onClick, children }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`inline-flex h-8 min-w-8 items-center justify-center rounded-lg border px-2 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        active
          ? 'border-primary/40 bg-primary/10 text-primary'
          : 'border-slate-200 bg-white text-charcoal-muted hover:border-primary/30 hover:text-primary'
      }`}
    >
      {children}
    </button>
  );
}

export interface WysiwygMarkdownEditorProps {
  /** Identificador estável do documento — recria o editor com o conteúdo correto. */
  documentKey: string;
  content: string;
  onContentChange: (markdown: string) => void;
  disabled?: boolean;
  placeholder?: string;
  fillHeight?: boolean;
}

export function WysiwygMarkdownEditor({
  documentKey,
  content,
  onContentChange,
  disabled = false,
  placeholder = 'Escreva ou edite o documento. A formatação aparece enquanto você digita.',
  fillHeight = false,
}: WysiwygMarkdownEditorProps) {
  const onContentChangeRef = useRef(onContentChange);
  onContentChangeRef.current = onContentChange;

  const editor = useEditor(
    {
      extensions: [
        StarterKit.configure({
          heading: { levels: [1, 2, 3] },
        }),
        Markdown,
        Placeholder.configure({ placeholder }),
      ],
      content,
      contentType: 'markdown',
      editable: !disabled,
      editorProps: {
        attributes: {
          class: 'tiptap-clinical-editor',
          'data-placeholder': placeholder,
        },
      },
      onUpdate: ({ editor: currentEditor }) => {
        onContentChangeRef.current(currentEditor.getMarkdown());
      },
    },
    [documentKey],
  );

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!disabled);
  }, [disabled, editor]);

  if (!editor) {
    return (
      <div
        className={`animate-pulse rounded-xl border border-slate-200 bg-slate-50 ${
          fillHeight ? 'min-h-[240px] flex-1' : 'min-h-[320px]'
        }`}
      />
    );
  }

  return (
    <div
      className={`flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white ${
        fillHeight ? 'min-h-0 flex-1' : ''
      }`}
    >
      <div className="flex shrink-0 flex-wrap items-center gap-1 border-b border-slate-100 bg-slate-50/80 px-2 py-2">
        <ToolbarButton
          label="Negrito"
          active={editor.isActive('bold')}
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          B
        </ToolbarButton>
        <ToolbarButton
          label="Itálico"
          active={editor.isActive('italic')}
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <span className="italic">I</span>
        </ToolbarButton>
        <span className="mx-1 h-5 w-px bg-slate-200" aria-hidden />
        <ToolbarButton
          label="Título grande"
          active={editor.isActive('heading', { level: 1 })}
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        >
          H1
        </ToolbarButton>
        <ToolbarButton
          label="Subtítulo"
          active={editor.isActive('heading', { level: 2 })}
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          H2
        </ToolbarButton>
        <ToolbarButton
          label="Seção"
          active={editor.isActive('heading', { level: 3 })}
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        >
          H3
        </ToolbarButton>
        <span className="mx-1 h-5 w-px bg-slate-200" aria-hidden />
        <ToolbarButton
          label="Lista com tópicos"
          active={editor.isActive('bulletList')}
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          • Lista
        </ToolbarButton>
        <ToolbarButton
          label="Lista numerada"
          active={editor.isActive('orderedList')}
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          1. Lista
        </ToolbarButton>
      </div>

      <div
        className={
          fillHeight
            ? 'min-h-0 flex-1 overflow-y-auto px-4 py-4 md:px-5 md:py-5'
            : 'min-h-[320px] overflow-y-auto px-4 py-4 md:min-h-[360px] md:px-5 md:py-5'
        }
      >
        <EditorContent editor={editor} className="h-full min-h-[200px]" />
      </div>
    </div>
  );
}
