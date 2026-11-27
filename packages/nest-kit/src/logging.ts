import { randomUUID } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import { LOG_REDACT_CENSOR, LOG_REDACT_PATHS, redactUrl } from '@agricoop/shared';
import type { Params } from 'nestjs-pino';

export interface LoggerOptions {
  serviceName: string;
  level: string;
  pretty?: boolean;
}

const UNLOGGED_PATHS = ['/health/live', '/health/ready', '/metrics'];

/** nestjs-pino configuration with PII / token / IP redaction. */
export function createLoggerParams(options: LoggerOptions): Params {
  return {
    pinoHttp: {
      name: options.serviceName,
      level: options.level,
      redact: { paths: [...LOG_REDACT_PATHS], censor: LOG_REDACT_CENSOR },
      genReqId: (req: IncomingMessage) => {
        const header = req.headers['x-request-id'];
        return typeof header === 'string' && /^[\w-]{8,64}$/.test(header) ? header : randomUUID();
      },
      autoLogging: {
        ignore: (req: IncomingMessage) => UNLOGGED_PATHS.includes(req.url ?? ''),
      },
      serializers: {
        // Log only what is needed: no IP, no headers beyond the user agent family, no query string.
        req: (req: { id?: string; method?: string; url?: string }) => ({
          id: req.id,
          method: req.method,
          url: redactUrl(req.url),
        }),
        res: (res: { statusCode?: number }) => ({ statusCode: res.statusCode }),
      },
      ...(options.pretty
        ? { transport: { target: 'pino-pretty', options: { singleLine: true } } }
        : {}),
    },
  };
}
