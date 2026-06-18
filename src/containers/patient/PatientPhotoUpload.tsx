import { useCallback, useRef, useState } from 'react';
import { PatientAvatar } from './PatientAvatar';
import { validatePatientAvatarFile } from './patient-avatar.validation';

interface PatientPhotoUploadProps {
  name: string;
  fotoUrl?: string | null;
  variant?: 'wizard' | 'clinical' | 'hero';
  disabled?: boolean;
  onFileSelected: (file: File) => void;
  onValidationError: (message: string) => void;
  previewUrl?: string | null;
}

export function PatientPhotoUpload({
  name,
  fotoUrl,
  variant = 'clinical',
  disabled,
  onFileSelected,
  onValidationError,
  previewUrl,
}: PatientPhotoUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const isWizard = variant === 'wizard';
  const isHero = variant === 'hero';

  const handleFile = useCallback(
    (file: File | undefined) => {
      if (!file || disabled) return;
      const result = validatePatientAvatarFile(file);
      if (!result.valid) {
        onValidationError(result.message);
        return;
      }
      onFileSelected(file);
    },
    [disabled, onFileSelected, onValidationError],
  );

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    handleFile(e.dataTransfer.files[0]);
  }

  return (
    <div
      className={
        isHero
          ? 'flex flex-col items-center'
          : isWizard
            ? ''
            : 'flex flex-col items-center sm:items-start'
      }
    >
      {!isHero && (
      <p
        className={`mb-3 text-sm font-medium ${isWizard ? 'text-slate-200' : 'text-charcoal'}`}
      >
        Foto de perfil <span className={isWizard ? 'text-slate-500' : 'text-charcoal-muted'}>(opcional)</span>
      </p>
      )}

      <div
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click();
        }}
        onClick={() => !disabled && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`group relative cursor-pointer rounded-full outline-none transition-all focus-visible:ring-2 focus-visible:ring-primary/50 ${
          dragOver ? 'scale-105' : ''
        } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
        aria-label="Selecionar foto do paciente"
      >
        <PatientAvatar
          name={name || '?'}
          fotoUrl={fotoUrl}
          previewUrl={previewUrl}
          size="xl"
        />

        {!disabled && (
          <span
            className={`absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full border-2 border-white shadow-sm transition-colors ${
              isWizard
                ? 'bg-primary/90 text-white group-hover:bg-primary'
                : 'bg-charcoal text-white group-hover:bg-charcoal-light'
            }`}
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <circle cx="12" cy="13" r="3" />
            </svg>
          </span>
        )}

        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="sr-only"
          disabled={disabled}
          onChange={(e) => {
            handleFile(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
      </div>

      <p
        className={`mt-3 max-w-[16rem] text-center text-xs ${
          isWizard ? 'text-slate-500' : 'text-charcoal-muted'
        } ${isHero ? '' : 'sm:text-left'}`}
      >
        {isHero ? 'Toque para alterar a foto' : 'Clique ou arraste · PNG, JPG ou WebP · máx. 5 MB'}
      </p>
    </div>
  );
}
