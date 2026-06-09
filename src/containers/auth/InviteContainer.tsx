import { InviteCodeInput } from '@features/invite-code/InviteCodeInput';

export default function InviteContainer() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-surface px-4">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <h1 className="text-xl font-semibold text-text">Therapy.AI</h1>
          <p className="mt-1 text-sm text-text-muted">
            Acesso para Familiares
          </p>
        </div>
        <InviteCodeInput />
      </div>
    </div>
  );
}
