import { InviteCodeForm } from '@containers/family/invite-link/InviteCodeForm';

export default function InviteContainer() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-[#F8FAF9] px-4">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <h1 className="font-display text-xl font-semibold text-charcoal">Unithery</h1>
          <p className="mt-1 text-sm text-charcoal-muted">Acesso para Familiares</p>
        </div>
        <InviteCodeForm />
      </div>
    </div>
  );
}
