import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { handleCors } from '../_shared/cors.ts';
import { successResponse, errorResponse } from '../_shared/response.ts';
import { authenticateRequest, requireClinicOwner } from '../_shared/auth.ts';
import { createServiceClient } from '../_shared/supabase.ts';
import { resolveClinicId, resolveOwnerName } from '../_shared/clinic.ts';
import { sendSesEmail } from '../_shared/aws-ses.ts';
import { buildBillingWelcomeEmail } from '../_shared/billing-email-templates.ts';
import { AppError } from '../_shared/errors.ts';

serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const user = await authenticateRequest(req);
    requireClinicOwner(user);

    const supabase = createServiceClient();
    const clinicId = await resolveClinicId(supabase, user);

    const { data: clinic } = await supabase
      .from('clinics')
      .select('name, email, subscription_plan, billing_cycle')
      .eq('id', clinicId)
      .maybeSingle();

    const to = (user.email || clinic?.email || '').trim().toLowerCase();
    if (!to) {
      throw new AppError({
        code: 'NO_EMAIL',
        message: 'Não há e-mail na conta para enviar o teste.',
        statusCode: 409,
      });
    }

    const ownerName = await resolveOwnerName(supabase, user);
    const content = buildBillingWelcomeEmail({
      ownerName,
      clinicName: (clinic?.name as string) || 'seu consultório',
      planId: (clinic?.subscription_plan as string) || 'standard',
      billingCycle: (clinic?.billing_cycle as 'monthly' | 'yearly' | null) ?? 'monthly',
    });

    await sendSesEmail({
      to,
      subject: `[TESTE] ${content.subject}`,
      html: content.html,
      text: content.text,
    });

    return successResponse({ sent: true, to, kind: 'welcome' }, req, 200);
  } catch (error) {
    return errorResponse(error, req);
  }
});
