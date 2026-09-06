import { Module } from '@nestjs/common'
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino'
import { randomUUID } from 'crypto'
import type { IncomingMessage, ServerResponse } from 'http'

/**
 * Centralized structured logging (pino) configuration.
 *
 * - Emits JSON logs in production so they can be shipped to a log
 *   aggregator (e.g. ELK, Datadog, CloudWatch, Loki).
 * - Pretty-prints logs in local/dev for human readability.
 * - Attaches/propagates an `x-request-id` correlation id on every request
 *   and response so a single request can be traced across log lines and
 *   returned to the client for support/troubleshooting.
 * - Redacts sensitive fields (passwords, tokens, auth headers) so secrets
 *   never end up in log output or a log aggregator.
 */
@Module({
  imports: [
    PinoLoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL || 'info',
        genReqId: (req: IncomingMessage, res: ServerResponse) => {
          const existing = req.headers['x-request-id']
          const requestId = Array.isArray(existing)
            ? existing[0]
            : existing || randomUUID()
          res.setHeader('x-request-id', requestId)
          return requestId
        },
        redact: {
          paths: [
            'req.headers.authorization',
            'req.headers.cookie',
            'res.headers["set-cookie"]',
            'req.body.password',
            'req.body.refreshToken',
            'req.body.idToken',
            'req.body.token',
          ],
          censor: '[REDACTED]',
        },
        customLogLevel: (
          _req: IncomingMessage,
          res: ServerResponse,
          err?: Error,
        ) => {
          if (err || res.statusCode >= 500) return 'error'
          if (res.statusCode >= 400) return 'warn'
          return 'info'
        },
        // Health checks and metrics scrapes are noisy and not useful in logs.
        autoLogging: {
          ignore: (req: IncomingMessage) =>
            req.url === '/health' || req.url === '/metrics',
        },
        // Pretty-print only for interactive local development. Production
        // needs raw JSON for log aggregators, and pino-pretty's transport
        // spawns a worker thread that can leave Jest's test runner hanging
        // ("did not exit one second after the test run"), so it's disabled
        // under `test` as well.
        transport: ['production', 'test'].includes(process.env.NODE_ENV || '')
          ? undefined
          : {
              target: 'pino-pretty',
              options: {
                colorize: true,
                singleLine: true,
                translateTime: 'HH:MM:ss.l',
              },
            },
      },
    }),
  ],
  exports: [PinoLoggerModule],
})
export class LoggerModule {}
