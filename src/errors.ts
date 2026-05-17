export class CliError extends Error {
  readonly exitCode: number;

  constructor(message: string, exitCode = 1) {
    super(message);
    this.name = "CliError";
    this.exitCode = exitCode;
  }
}

export class ImageApiError extends CliError {
  readonly status?: number;
  readonly retryAfter?: number;

  constructor(message: string, options: { status?: number; retryAfter?: number } = {}) {
    super(message);
    this.name = "ImageApiError";
    this.status = options.status;
    this.retryAfter = options.retryAfter;
  }
}

export function formatError(error: unknown): string {
  if (error instanceof CliError) {
    return `Error: ${error.message}`;
  }
  if (error instanceof Error) {
    return error.stack || error.message;
  }
  return String(error);
}
