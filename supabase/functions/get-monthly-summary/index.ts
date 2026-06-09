import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { handleCors } from '../_shared/cors.ts';
import { successResponse, errorResponse } from '../_shared/response.ts';
import { authenticateRequest, requireRole } from '../_shared/auth.ts';
import { createServiceClient } from '../_shared/supabase.ts';
import { AppError, ValidationError } from '../_shared/errors.ts';

/**
 * get-monthly-summary
 *
 * Payload leve para os "spoilers" do grid mensal: contagem agregada de sessões
 * por dia (fuso BR) do terapeuta autenticado. Não retorna dados de pacientes.
 */

const BR_TZ = 'America/Sao_Paulo';

function brDay(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: BR_TZ, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(d);
}

serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const user = await authenticateRequest(req);
    requireRole(user, ['professional']);

    const body = await req.json().catch(() => ({}));
    const year = Number(body.year);
    const month = Number(body.month); // 1-12
    if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
      throw new ValidationError({ month: 'Informe year (ex: 2026) e month (1-12).' });
    }

    const supabase = createServiceClient();

    const { data: professional } = await supabase
      .from('professionals')
      .select('id')
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .single();

    if (!professional) {
      throw new AppError({ code: 'NO_ACCESS', message: 'Profissional não encontrado', statusCode: 403 });
    }

    // Janela do mês no fuso BR (com folga de 1 dia em cada ponta para cobrir bordas de fuso)
    const mm = String(month).padStart(2, '0');
    const firstDay = `${year}-${mm}-01T00:00:00-03:00`;
    const nextMonth = month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const monthEnd = `${nextMonth}T00:00:00-03:00`;

    const { data: rows, error } = await supabase
      .from('therapist_schedule')
      .select('scheduled_at, status')
      .eq('professional_id', professional.id)
      .is('deleted_at', null)
      .gte('scheduled_at', firstDay)
      .lt('scheduled_at', monthEnd);

    if (error) {
      throw new AppError({ code: 'FETCH_FAILED', message: error.message, statusCode: 500 });
    }

    const counts = new Map<string, number>();
    for (const r of rows ?? []) {
      const key = brDay(new Date(r.scheduled_at));
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    const days = [...counts.entries()]
      .map(([date, total_sessions]) => ({ date, total_sessions }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return successResponse({ year, month, days }, req, 200);
  } catch (error) {
    return errorResponse(error, req);
  }
});
