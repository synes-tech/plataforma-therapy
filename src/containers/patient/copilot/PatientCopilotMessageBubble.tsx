import DOMPurify from 'dompurify';
import { ThinkingIndicator } from '@features/copilot/ThinkingIndicator';
import { BRAND_LOGO_SRC } from '@shared/lib/brand-assets';
import { PatientCopilotArtifactToolbar } from './PatientCopilotArtifactToolbar';
import { DOC_TYPE_LABELS } from './patient-copilot.constants';
import type { AiArtifactType, CopilotMessage } from './patient-copilot.types';

interface PatientCopilotMessageBubbleProps {
  message: CopilotMessage;
  savedTypes: Set<AiArtifactType>;
  savingType: AiArtifactType | null;
  onSaveArtifact: (tipo: AiArtifactType) => void;
}

export function PatientCopilotMessageBubble({
  message,
  savedTypes,
  savingType,
  onSaveArtifact,
}: PatientCopilotMessageBubbleProps) {
  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-none bg-primary px-4 py-2.5 text-sm leading-relaxed text-white shadow-sm">
          {message.content}
        </div>
      </div>
    );
  }

  const showToolbar =
    !message.guardrail_triggered && !message.streaming && message.content.trim().length > 0;

  return (
    <div className="flex justify-start gap-2.5">
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-100 bg-white shadow-sm">
        <img src={BRAND_LOGO_SRC} alt="" className="h-5 w-5 object-contain" aria-hidden />
      </div>

      <div
        className={`max-w-[85%] rounded-2xl rounded-bl-none border border-gray-100 bg-white px-4 py-3 shadow-sm ${
          message.guardrail_triggered ? 'border-amber-200' : ''
        }`}
      >
        {message.streaming && !message.content && <ThinkingIndicator />}

        {message.content && (
          <p
            className="animate-fade-in whitespace-pre-wrap text-sm leading-relaxed text-gray-900"
            dangerouslySetInnerHTML={{
              __html: DOMPurify.sanitize(message.content, { ALLOWED_TAGS: [] }),
            }}
          />
        )}

        {message.streaming && message.content && (
          <span
            className="ml-0.5 inline-block h-4 w-[3px] animate-pulse rounded-sm bg-primary align-middle"
            aria-hidden
          />
        )}

        {message.sources && message.sources.length > 0 && (
          <div className="mt-3 border-t border-slate-100 pt-2">
            <p className="text-[10px] font-medium text-charcoal-muted">Fontes</p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {message.sources.map((src, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 rounded-md bg-slate-50 px-1.5 py-0.5 text-[10px] text-charcoal-muted"
                >
                  {DOC_TYPE_LABELS[src.document_type] ?? src.document_type}
                  <span className="text-slate-300">·</span>
                  {src.created_at.split('T')[0]}
                </span>
              ))}
            </div>
          </div>
        )}

        {message.guardrail_triggered && (
          <p className="mt-2 text-[10px] text-amber-600">Filtro de segurança ativado</p>
        )}

        {message.answer_incomplete && !message.guardrail_triggered && (
          <div className="mt-2 rounded-lg border border-amber-100 bg-amber-50/80 px-2.5 py-1.5 text-[11px] text-amber-700">
            A resposta pode ter sido cortada. Peça para repetir ou continuar de onde parou.
          </div>
        )}

        {showToolbar && (
          <PatientCopilotArtifactToolbar
            content={message.content}
            savedTypes={savedTypes}
            savingType={savingType}
            onSave={(tipo) => onSaveArtifact(tipo)}
          />
        )}
      </div>
    </div>
  );
}
