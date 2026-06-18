import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { handleCors } from '../_shared/cors.ts';
import { successResponse, errorResponse } from '../_shared/response.ts';
import { authenticateRequest, requireRole } from '../_shared/auth.ts';
import { createServiceClient } from '../_shared/supabase.ts';
import { AppError, ValidationError } from '../_shared/errors.ts';

/**
 * get-monthly-summary
 *
 * Contagem agregada de sessões por dia (fuso BR) do terapeuta.
 * Aceita year+month (visão mensal) ou start_date+end_date (semana/lista).
 */

const BR_TZ = 'America/Sao_Paulo';
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function brDay(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: BR_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

function addDaysISO(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y!, (m ?? 1) - 1, d);
  date.setDate(date.getDate() + days);
  const yy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

function resolveWindow(body: Record<string, unknown>): {
  rangeStart: string;
  rangeEndExclusive: string;
  year?: number;
  month?: number;
  start_date?: string;
  end_date?: string;
} {
  const startDate = typeof body.start_date === 'string' ? body.start_date : '';
  const endDate = typeof body.end_date === 'string' ? body.end_date : '';

  if (startDate || endDate) {
    if (!DATE_RE.test(startDate) || !DATE_RE.test(endDate)) {
      throw new ValidationError({
        start_date: 'Informe start_date e end_date no formato YYYY-MM-DD.',
      });
    }
    if (startDate > endDate) {
      throw new ValidationError({
        end_date: 'end_date deve ser igual ou posterior a start_date.',
      });
    }

    return {
      rangeStart: `${startDate}T00:00:00-03:00`,
      rangeEndExclusive: `${addDaysISO(endDate, 1)}T00:00:00-03:00`,
      start_date: startDate,
      end_date: endDate,
    };
  }

  const year = Number(body.year);
  const month = Number(body.month);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    throw new ValidationError({ month: 'Informe year (ex: 2026) e month (1-12), ou start_date/end_date.' });
  }

  const mm = String(month).padStart(2, '0');
  const firstDay = `${year}-${mm}-01`;
  const nextMonth = month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, '0')}-01`;

  return {
    rangeStart: `${firstDay}T00:00:00-03:00`,
    rangeEndExclusive: `${nextMonth}T00:00:00-03:00`,
    year,
    month,
  };
}

serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const user = await authenticateRequest(req);
    requireRole(user, ['professional']);

    const body = await req.json().catch(() => ({}));
    const window = resolveWindow(body as Record<string, unknown>);

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

    const { data: rows, error } = await supabase
      .from('therapist_schedule')
      .select('scheduled_at, status')
      .eq('professional_id', professional.id)
      .is('deleted_at', null)
      .gte('scheduled_at', window.rangeStart)
      .lt('scheduled_at', window.rangeEndExclusive);

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

    return successResponse(
      {
        year: window.year,
        month: window.month,
        start_date: window.start_date,
        end_date: window.end_date,
        days,
      },
      req,
      200,
    );
  } catch (error) {
    return errorResponse(error, req);
  }
});
