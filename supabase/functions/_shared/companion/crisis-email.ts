import { sendSesEmail } from '../aws-ses.ts';
import { createServiceClient } from '../supabase.ts';
import { shouldEmailCrisisAlert, type CrisisEmailKind } from './alerts.ts';
import { buildCrisisAlertEmail, clipReportedText } from './crisis-email-templates.ts';

function appOrigin(): string {
  return (Deno.env.get('PUBLIC_APP_URL') ?? 'https://unithery.com').replace(/\/+$/, '');
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export interface NotifyCrisisParams {
  patientId: string;
  clinicId: string;
  kind: CrisisEmailKind;
  reportedText: string;
  crisisLevel?: number | null;
  entryDate?: string | null;
}

export async function notifyProfessionalOfCrisis(params: NotifyCrisisParams): Promise<boolean> {
  try {
    const supabase = createServiceClient();

    const { data: prefs } = await supabase
      .from('clinic_preferences')
      .select('crisis_alerts_email')
      .eq('clinic_id', params.clinicId)
      .maybeSingle();

    const clinicAllowsEmail = prefs?.crisis_alerts_email !== false;
    if (!shouldEmailCrisisAlert({ kind: params.kind, clinicAllowsEmail })) {
      return false;
    }

    const { data: patient } = await supabase
      .from('patients')
      .select('name, professional_id')
      .eq('id', params.patientId)
      .is('deleted_at', null)
      .maybeSingle();

    const professionalId = (patient as { professional_id?: string } | null)?.professional_id;
    if (!professionalId) {
      console.warn(JSON.stringify({
        level: 'warn',
        action: 'crisis_email_skipped',
        reason: 'no_professional',
        patient_id: params.patientId,
      }));
      return false;
    }

    const { data: professional } = await supabase
      .from('professionals')
      .select('name, email')
      .eq('id', professionalId)
      .is('deleted_at', null)
      .maybeSingle();

    const to = typeof professional?.email === 'string' ? professional.email.trim().toLowerCase() : '';
    if (!isValidEmail(to)) {
      console.warn(JSON.stringify({
        level: 'warn',
        action: 'crisis_email_skipped',
        reason: 'no_professional_email',
        patient_id: params.patientId,
        professional_id: professionalId,
      }));
      return false;
    }

    const recordPath = params.kind === 'checkin_crisis'
      ? `/patients/${params.patientId}/checkins${params.entryDate ? `?date=${params.entryDate}` : ''}`
      : `/patients/${params.patientId}/copilot`;

    const email = buildCrisisAlertEmail({
      professionalName: professional?.name ?? '',
      patientName: (patient as { name?: string } | null)?.name ?? '',
      kind: params.kind,
      reportedText: clipReportedText(params.reportedText),
      recordUrl: `${appOrigin()}${recordPath}`,
      crisisLevel: params.crisisLevel,
    });

    const messageId = await sendSesEmail({
      to,
      subject: email.subject,
      html: email.html,
      text: email.text,
    });

    console.log(JSON.stringify({
      level: 'info',
      action: 'crisis_email_sent',
      kind: params.kind,
      patient_id: params.patientId,
      professional_id: professionalId,
      to,
      message_id: messageId,
    }));
    return true;
  } catch (err) {
    console.error(JSON.stringify({
      level: 'error',
      action: 'crisis_email_failed',
      patient_id: params.patientId,
      kind: params.kind,
      message: err instanceof Error ? err.message : String(err),
    }));
    return false;
  }
}
