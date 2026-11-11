import { STATUS_CODES } from 'node:http';
import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import { type ProblemDetails, redactUrl } from '@agricoop/shared';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { ZodValidationException } from 'nestjs-zod';
import type { ZodError } from 'zod';
import { AppProblem } from './problem.js';

export const PROBLEM_CONTENT_TYPE = 'application/problem+json';

interface ProblemBody extends ProblemDetails {
  code?: string;
}

/**
 * Renders every error as RFC 7807 application/problem+json.
 * - AppProblem → its code/title/detail.
 * - Zod validation → 400 with `errors: [{ path, message }]` (messages describe types, never values).
 * - Other HttpExceptions → standard title, detail only when it is a plain string message.
 * - Anything else → 500 without details; the error is logged server-side (with redaction).
 */
@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ProblemDetails');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const reply = ctx.getResponse<FastifyReply>();
    const request = ctx.getRequest<FastifyRequest>();
    const body = this.toProblem(exception);
    body.instance = redactUrl(request.url);

    if (body.status >= 500) {
      this.logger.error({ err: exception, requestId: request.id }, 'Unhandled error');
    }
    if (body.status === 401) void reply.header('www-authenticate', 'Bearer');
    void reply.status(body.status).header('content-type', PROBLEM_CONTENT_TYPE).send(body);
  }

  private toProblem(exception: unknown): ProblemBody {
    if (exception instanceof AppProblem) {
      return {
        type: `urn:agricoop:problem:${exception.code}`,
        title: exception.title,
        status: exception.getStatus(),
        code: exception.code,
        ...(exception.detail ? { detail: exception.detail } : {}),
      };
    }
    if (exception instanceof ZodValidationException) {
      const zodError = exception.getZodError() as ZodError;
      return {
        type: 'urn:agricoop:problem:validation',
        title: 'Validation failed',
        status: 400,
        code: 'validation',
        errors: zodError.issues.map((i) => ({
          path: i.path.map(String).join('.'),
          message: i.message,
        })),
      };
    }
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const response = exception.getResponse();
      const message =
        typeof response === 'string'
          ? response
          : typeof (response as { message?: unknown }).message === 'string'
            ? (response as { message: string }).message
            : undefined;
      const title = STATUS_CODES[status] ?? 'Error';
      return {
        type: 'about:blank',
        title,
        status,
        ...(message && message !== title ? { detail: message } : {}),
      };
    }
    // Fastify errors (e.g. malformed JSON body) carry a statusCode < 500.
    const statusCode = (exception as { statusCode?: unknown } | null)?.statusCode;
    if (typeof statusCode === 'number' && statusCode >= 400 && statusCode < 500) {
      return {
        type: 'about:blank',
        title: STATUS_CODES[statusCode] ?? 'Error',
        status: statusCode,
      };
    }
    return { type: 'about:blank', title: 'Internal Server Error', status: 500 };
  }
}
