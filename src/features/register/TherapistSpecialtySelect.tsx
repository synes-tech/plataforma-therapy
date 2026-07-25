import { THERAPIST_SPECIALTY_OPTIONS } from './therapist-specialties';
import { RegisterInput } from './RegisterInput';

const SELECT_CLASS =
  'h-12 w-full appearance-none rounded-xl border border-slate-200 bg-white bg-[length:1rem] bg-[right_1rem_center] bg-no-repeat px-4 pr-11 text-sm text-charcoal transition-all duration-200 focus:border-primary/50 focus:outline-none focus:ring-[3px] focus:ring-primary/10';

const CHEVRON_SVG =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23475569' stroke-width='2'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E\")";

interface TherapistSpecialtySelectProps {
  selectedId: string;
  otherValue: string;
  onSelect: (id: string) => void;
  onOtherChange: (value: string) => void;
}

export function TherapistSpecialtySelect({
  selectedId,
  otherValue,
  onSelect,
  onOtherChange,
}: TherapistSpecialtySelectProps) {
  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="specialty" className="mb-2 block text-sm font-medium text-charcoal">
          Especialidade *
        </label>
        <select
          id="specialty"
          value={selectedId}
          onChange={(e) => onSelect(e.target.value)}
          required
          className={SELECT_CLASS}
          style={{ backgroundImage: CHEVRON_SVG }}
        >
          <option value="" disabled>
            Selecione sua área de atuação
          </option>
          {THERAPIST_SPECIALTY_OPTIONS.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
        <p className="mt-2 text-xs leading-relaxed text-charcoal-muted">
          Isso personaliza seu perfil. Você pode alterar depois em Configurações.
        </p>
      </div>

      {selectedId === 'outros' && (
        <RegisterInput
          id="specialty_other"
          label="Qual é a sua especialidade? *"
          value={otherValue}
          onChange={onOtherChange}
          required
          placeholder="Ex: Psicomotricidade, ABA..."
        />
      )}
    </div>
  );
}
