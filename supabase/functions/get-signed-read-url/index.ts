import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { handleCors } from '../_shared/cors.ts';
import { successResponse, errorResponse } from '../_shared/response.ts';
import { authenticateRequest } from '../_shared/auth.ts';
import { createReadUrl, type LogicalBucket } from '../_shared/object-storage.ts';
import { AppError, ForbiddenError, ValidationError } from '../_shared/errors.ts';
import { GetSignedReadUrlSchema } from './schema.ts';

serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const user = await authenticateRequest(req);
    const body = await req.json().catch(() => ({}));
    const parsed = GetSignedReadUrlSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(new ValidationError(parsed.error.flatten().fieldErrors), req);
    }

    const { bucket, path, expires_in } = parsed.data;
    const clinicPrefix = path.split('/')[0];
    if (!clinicPrefix) {
      throw new ValidationError({ path: ['Caminho inválido'] });
    }

    if (user.role !== 'master') {
      if (!user.clinic_id || clinicPrefix !== user.clinic_id) {
        throw new ForbiddenError('Sem permissão para este arquivo.');
      }
    }

    // Família: só diário familiar e avatar do paciente (mesmo prefixo de clínica)
    if (user.role === 'family') {
      const allowed: LogicalBucket[] = ['family-diary-audio', 'pacientes-avatars'];
      if (!allowed.includes(bucket as LogicalBucket)) {
        throw new ForbiddenError('Sem permissão para este tipo de arquivo.');
      }
    }

    const { signedUrl, backend } = await createReadUrl(
      bucket as LogicalBucket,
      path,
      expires_in ?? 3600,
    );

    return successResponse({
      url: signedUrl,
      expires_in: expires_in ?? 3600,
      backend,
    }, req);
  } catch (err) {
    if (err instanceof AppError || err instanceof ForbiddenError || err instanceof ValidationError) {
      return errorResponse(err, req);
    }
    console.error('get-signed-read-url', err);
    return errorResponse(
      new AppError({
        code: 'SIGNED_URL_FAILED',
        message: err instanceof Error ? err.message : 'Falha ao assinar URL',
        statusCode: 500,
      }),
      req,
    );
  }
});
