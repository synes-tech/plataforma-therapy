import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { handleCors } from '../_shared/cors.ts';
import { successResponse, errorResponse } from '../_shared/response.ts';
import { authenticateRequest, requireClinicOwner, logAuthEvent } from '../_shared/auth.ts';
import { ValidationError } from '../_shared/errors.ts';
import { UploadProfessionalAvatarSchema } from './schema.ts';
import { uploadProfessionalAvatar } from './service.ts';

serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    if (req.method !== 'POST') {
      return errorResponse(new ValidationError({ method: 'Only POST is allowed' }), req);
    }

    const user = await authenticateRequest(req);
    requireClinicOwner(user);
    logAuthEvent('upload_professional_avatar.attempt', user, 'upload-professional-avatar');

    const body = await req.json();
    const parseResult = UploadProfessionalAvatarSchema.safeParse(body);

    if (!parseResult.success) {
      return errorResponse(new ValidationError(parseResult.error.flatten().fieldErrors), req);
    }

    const data = parseResult.data;
    const result = await uploadProfessionalAvatar(
      data.action === 'confirm'
        ? { action: 'confirm', storage_path: data.storage_path }
        : {
            action: 'initiate',
            mime_type: data.mime_type,
            file_size_bytes: data.file_size_bytes,
          },
      user,
    );
    return successResponse(result, req);
  } catch (error) {
    return errorResponse(error, req);
  }
});
