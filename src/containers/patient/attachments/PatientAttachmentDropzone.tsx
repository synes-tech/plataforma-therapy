import { useRef, useState } from 'react';
import { LoadingButton } from '@containers/loading';
import { ALLOWED_ATTACHMENT_EXTENSIONS } from './patient-attachment.types';
import { validatePatientAttachmentFile } from './patient-attachment.utils';

interface PatientAttachmentDropzoneProps {
  disabled?: boolean;
  onFilesSelected: (files: File[]) => void;
  label?: string;
  hint?: string;
  variant?: 'light' | 'dark';
}

export function PatientAttachmentDropzone({
  disabled = false,
  onFilesSelected,
  label = 'Enviar documentos',
  hint = 'PDF, Word ou TXT — até 15 MB cada. Os arquivos serão vetorizados para o Copiloto IA.',
  variant = 'light',
}: PatientAttachmentDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleFiles(fileList: FileList | null) {
    if (!fileList || disabled) return;
    const accepted: File[] = [];

    for (const file of Array.from(fileList)) {
      const validation = validatePatientAttachmentFile(file);
      if (!validation.valid) {
        setError(validation.message ?? 'Arquivo inválido');
        return;
      }
      accepted.push(file);
    }

    if (accepted.length === 0) return;
    setError(null);
    onFilesSelected(accepted);
  }

  const surfaceClass =
    variant === 'dark'
      ? 'border-white/15 bg-white/5 hover:border-primary/40 hover:bg-white/[0.07]'
      : 'border-slate-200 bg-slate-50/80 hover:border-primary/35 hover:bg-primary/[0.03]';

  const textClass = variant === 'dark' ? 'text-slate-200' : 'text-charcoal';
  const mutedClass = variant === 'dark' ? 'text-slate-400' : 'text-charcoal-muted';

  return (
    <div className="space-y-2">
      <div
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragOver(false);
          handleFiles(event.dataTransfer.files);
        }}
        onClick={() => !disabled && inputRef.current?.click()}
        className={`flex min-h-[132px] cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed px-4 py-6 text-center transition-colors ${
          dragOver ? 'border-primary bg-primary/5' : surfaceClass
        } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
        aria-disabled={disabled}
      >
        <p className={`text-sm font-medium ${textClass}`}>{label}</p>
        <p className={`mt-1 max-w-md text-xs ${mutedClass}`}>{hint}</p>
        <LoadingButton
          type="button"
          variant="secondary"
          className="mt-4 min-h-10"
          disabled={disabled}
          onClick={(event) => {
            event.stopPropagation();
            inputRef.current?.click();
          }}
        >
          Selecionar arquivos
        </LoadingButton>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ALLOWED_ATTACHMENT_EXTENSIONS.join(',')}
          className="hidden"
          disabled={disabled}
          onChange={(event) => {
            handleFiles(event.target.files);
            event.target.value = '';
          }}
        />
      </div>
      {error && (
        <p className="text-xs text-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
