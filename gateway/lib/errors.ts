// Error taxonomy for the gateway.
//
// Error codes mapped to HTTP statuses, matching the provider error taxonomy used
// across the gateway and client integrations.
//
// | Error            | HTTP status | Code            |
// | ---------------- | ----------- | --------------- |
// | ProviderNotFound | 400         | BAD_REQUEST     |
// | MissingParam     | 400         | BAD_REQUEST     |
// | InvalidParam     | 422         | INVALID_INPUT   |
// | Worker           | 502         | UPSTREAM_ERROR  |
// | Upstream         | mirrors     | UPSTREAM_ERROR  |
// | Timeout          | 504         | TIMEOUT         |
// | Internal         | 500         | ERROR           |

/** Every failure the gateway can produce, plus its HTTP mapping. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }

  /** An unknown/disabled provider id. */
  static providerNotFound(provider: string): ApiError {
    return new ApiError(`unknown provider: ${provider}`, 400, 'BAD_REQUEST');
  }

  /** A required query parameter was missing or empty. */
  static missingParam(name: string): ApiError {
    return new ApiError(`missing required parameter: ${name}`, 400, 'BAD_REQUEST');
  }

  /** A query parameter failed a constraint (e.g. too long). */
  static invalidParam(message: string): ApiError {
    return new ApiError(message, 422, 'INVALID_INPUT');
  }

  /** The provider execution engine itself failed (bundle, backend, or crash). */
  static worker(message: string): ApiError {
    return new ApiError(`provider worker failed: ${message}`, 502, 'UPSTREAM_ERROR');
  }

  /** The provider bundle raised an error while scraping an upstream host. */
  static upstream(status: number, message: string): ApiError {
    const code = 'UPSTREAM_ERROR';
    const safeStatus = status >= 400 && status < 600 ? status : 502;
    return new ApiError(
      `upstream provider error (HTTP ${safeStatus}): ${message}`,
      safeStatus,
      code,
    );
  }

  /** A provider call exceeded the configured timeout. */
  static timeout(): ApiError {
    return new ApiError('provider request timed out', 504, 'TIMEOUT');
  }

  /** An unexpected internal failure. */
  static internal(message: string): ApiError {
    return new ApiError(`internal server error: ${message}`, 500, 'ERROR');
  }

  /** Build an error with an arbitrary HTTP status and envelope code. */
  static from(message: string, status: number, code: string): ApiError {
    const safeStatus = status >= 400 && status < 600 ? status : 500;
    return new ApiError(message, safeStatus, code);
  }

  /** Whether retrying the call on a different backend/host is likely to help. */
  get isTransient(): boolean {
    return (
      this.status === 504 || // timeout
      this.status === 502 || // worker
      this.status >= 500 // upstream server error
    );
  }

  /** Whether this error came from the provider itself rather than the gateway. */
  get isUpstream(): boolean {
    return this.status >= 400 && this.code === 'UPSTREAM_ERROR';
  }
}

/** Wrap an unknown thrown value into an ApiError. */
export function toApiError(err: unknown): ApiError {
  if (err instanceof ApiError) return err;
  if (err instanceof Error) return ApiError.internal(err.message);
  return ApiError.internal(String(err));
}

/** Build the `{ success: false, error, code }` body for a given ApiError. */
export function errorBody(err: ApiError): Record<string, unknown> {
  return { success: false, error: err.message, code: err.code };
}

/** Build the `{ success: true, data }` body. */
export function successBody(data: unknown): Record<string, unknown> {
  return { success: true, data };
}

/** The 404 body used by the catch-all handler. */
export function notFoundBody(): Record<string, unknown> {
  return { success: false, error: 'not found', code: 'NOT_FOUND' };
}
