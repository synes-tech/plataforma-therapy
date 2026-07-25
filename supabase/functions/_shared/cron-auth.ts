import { ForbiddenError } from './errors.ts';

export function assertCronAuth(req: Request): void {
  const expected = Deno.env.get('CRON_SECRET');
  const provided = req.headers.get('X-Cron-Secret');

  if (!expected || !provided || provided !== expected) {
    throw new ForbiddenError('Cron não autorizado');
  }
}
