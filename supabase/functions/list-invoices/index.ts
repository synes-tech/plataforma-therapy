import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { handleCors } from '../_shared/cors.ts';
import { successResponse, errorResponse } from '../_shared/response.ts';
import { authenticateRequest, requireClinicOwner, logAuthEvent } from '../_shared/auth.ts';
import { createServiceClient } from '../_shared/supabase.ts';
import { resolveClinicId } from '../_shared/clinic.ts';
import { AppError } from '../_shared/errors.ts';

serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const user = await authenticateRequest(req);
    requireClinicOwner(user);

    const supabase = createServiceClient();
    const clinicId = await resolveClinicId(supabase, user);

    const { data: invoices, error } = await supabase
      .from('invoices')
      .select(
        'id, invoice_number, description, plan_label, amount_cents, currency, status, period_start, period_end, due_date, paid_at, payment_method, created_at',
      )
      .eq('clinic_id', clinicId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      throw new AppError({ code: 'FETCH_FAILED', message: error.message, statusCode: 500 });
    }

    const list = invoices ?? [];

    // Summary for the billing header
    const paid = list.filter((i) => i.status === 'paid');
    const open = list.filter((i) => i.status === 'pending' || i.status === 'overdue');
    const summary = {
      total_invoices: list.length,
      total_paid_cents: paid.reduce((s, i) => s + (i.amount_cents ?? 0), 0),
      open_amount_cents: open.reduce((s, i) => s + (i.amount_cents ?? 0), 0),
      has_overdue: list.some((i) => i.status === 'overdue'),
    };

    logAuthEvent('invoices.list', user, 'list-invoices', { count: list.length });

    return successResponse({ invoices: list, summary }, req, 200);
  } catch (error) {
    return errorResponse(error, req);
  }
});
