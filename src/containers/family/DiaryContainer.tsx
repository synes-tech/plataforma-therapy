import { useQuery } from '@tanstack/react-query';
import { supabase } from '@shared/lib/supabase';
import { useAuth } from '@shared/hooks/useAuth';
import { DiaryForm } from '@features/diary-form/DiaryForm';

export default function DiaryContainer() {
  const { user } = useAuth();

  // Get linked patient_id for this family member
  const { data: familyData, isLoading } = useQuery({
    queryKey: ['family-member-link', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('family_members')
        .select('id, patient_id, patients(name)')
        .eq('user_id', user!.id)
        .is('deleted_at', null)
        .single();

      if (error) throw error;
      // Supabase returns single relations as objects when using .single()
      return data as unknown as { id: string; patient_id: string; patients: { name: string } };
    },
    enabled: !!user,
  });

  if (isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-surface">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!familyData) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-surface px-4 text-center">
        <p className="text-text-muted">Nenhum paciente vinculado.</p>
        <a href="/invite" className="mt-2 text-sm text-primary">Inserir código de convite</a>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-surface px-4 pb-8 pt-6">
      {/* Header */}
      <header className="mb-6">
        <h1 className="text-xl font-semibold text-text">Diário de Rotina</h1>
        <p className="mt-1 text-sm text-text-muted">
          Como foi o dia de <span className="text-primary-light">{familyData.patients.name}</span>?
        </p>
      </header>

      {/* Diary form */}
      <DiaryForm patientId={familyData.patient_id} />
    </div>
  );
}
