/**
 * Substitui deno.land/std/http/server.ts no Cloud Run:
 * em vez de abrir porta por função, registra o handler no mapa global.
 */
export type Handler = (req: Request) => Response | Promise<Response>;

const registry = new Map<string, Handler>();
let currentFunctionName = 'unknown';

export function setCurrentFunctionName(name: string): void {
  currentFunctionName = name;
}

export function getHandler(name: string): Handler | undefined {
  return registry.get(name);
}

export function listHandlers(): string[] {
  return [...registry.keys()].sort();
}

export function serve(handler: Handler): void {
  registry.set(currentFunctionName, handler);
}
