export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly details?: unknown;

  constructor(params: { code: string; message: string; statusCode?: number; details?: unknown }) {
    super(params.message);
    this.code = params.code;
    this.statusCode = params.statusCode ?? 400;
    this.details = params.details;
    this.name = 'AppError';
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required') {
    super({ code: 'UNAUTHORIZED', message, statusCode: 401 });
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Insufficient permissions') {
    super({ code: 'FORBIDDEN', message, statusCode: 403 });
    this.name = 'ForbiddenError';
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super({ code: 'NOT_FOUND', message: `${resource} not found`, statusCode: 404 });
    this.name = 'NotFoundError';
  }
}

export class QuotaExceededError extends AppError {
  constructor(resource: string) {
    super({ code: 'QUOTA_EXCEEDED', message: `Quota exceeded for ${resource}`, statusCode: 429 });
    this.name = 'QuotaExceededError';
  }
}

export class ValidationError extends AppError {
  constructor(details: unknown) {
    super({ code: 'VALIDATION_ERROR', message: 'Invalid input', statusCode: 400, details });
    this.name = 'ValidationError';
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super({ code: 'CONFLICT', message, statusCode: 409 });
    this.name = 'ConflictError';
  }
}
