import { WysiwygMarkdownEditor } from './WysiwygMarkdownEditor';

export interface MarkdownDocumentEditorProps {
  documentKey: string;
  title: string;
  onTitleChange: (value: string) => void;
  content: string;
  onContentChange: (value: string) => void;
  titleLabel?: string;
  contentLabel?: string;
  titlePlaceholder?: string;
  contentPlaceholder?: string;
  disabled?: boolean;
  /** Preenche a altura disponível do container pai (modo tela cheia). */
  fillHeight?: boolean;
}

export function MarkdownDocumentEditor({
  documentKey,
  title,
  onTitleChange,
  content,
  onContentChange,
  titleLabel = 'Título do documento',
  contentLabel = 'Conteúdo',
  titlePlaceholder = 'Ex.: Plano de rotina — semana 12',
  contentPlaceholder = 'Escreva ou edite o documento. A formatação aparece enquanto você digita.',
  disabled = false,
  fillHeight = false,
}: MarkdownDocumentEditorProps) {
  return (
    <div className={fillHeight ? 'flex min-h-0 flex-1 flex-col gap-4' : 'space-y-4'}>
      <div>
        <label htmlFor="markdown-doc-title" className="mb-1.5 block text-xs font-semibold text-charcoal">
          {titleLabel}
        </label>
        <input
          id="markdown-doc-title"
          type="text"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          disabled={disabled}
          maxLength={200}
          placeholder={titlePlaceholder}
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-charcoal outline-none transition-colors placeholder:text-charcoal-muted/50 focus:border-primary/40 focus:ring-2 focus:ring-primary/10 disabled:opacity-50"
        />
      </div>

      <div className={fillHeight ? 'flex min-h-0 flex-1 flex-col' : undefined}>
        <p className="mb-2 text-xs font-semibold text-charcoal">{contentLabel}</p>
        <WysiwygMarkdownEditor
          documentKey={documentKey}
          content={content}
          onContentChange={onContentChange}
          disabled={disabled}
          placeholder={contentPlaceholder}
          fillHeight={fillHeight}
        />
      </div>
    </div>
  );
}
