import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common'
import { HttpAdapterHost } from '@nestjs/core'
import type { Request } from 'express'

type RequestWithId = Request & { id?: string | number }

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  // See auth.service.ts for why this is a plain instance field rather than
  // an injected PinoLogger: it keeps this filter constructible without the
  // real LoggerModule present, while still routing through pino once
  // `app.useLogger(app.get(Logger))` is called at bootstrap.
  private readonly logger = new Logger(HttpExceptionFilter.name)

  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    // In certain situations `httpAdapter` might not be available in the
    // constructor method, thus we should resolve it here.
    const { httpAdapter } = this.httpAdapterHost

    const ctx = host.switchToHttp()
    const request = ctx.getRequest<RequestWithId>()
    const requestId = request?.id

    const httpStatus =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR
    const response =
      exception instanceof HttpException
        ? exception.getResponse()
        : {
            message:
              'Something went wrong on the server. Contact support if the problem persists.',
            statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
            error: 'Internal Server Error',
          }

    const path = httpAdapter.getRequestUrl(request) as string

    // Unexpected (non-HttpException) or 5xx errors are real operational
    // problems: log at error level with the stack trace so they surface
    // in alerting. Expected 4xx client errors (validation, auth, not
    // found, etc.) are logged at warn level without noisy stack traces.
    if (httpStatus >= 500) {
      this.logger.error(
        { err: exception, requestId, path },
        'Unhandled exception while processing request',
      )
    } else {
      this.logger.warn(
        { requestId, path, statusCode: httpStatus },
        exception instanceof HttpException
          ? exception.message
          : 'Request failed',
      )
    }

    const responseBody = {
      type:
        exception instanceof HttpException
          ? exception.message
          : 'Internal server error',
      statusCode: httpStatus,
      timestamp: new Date().toISOString(),
      path,
      requestId,
      response,
    }

    httpAdapter.reply(ctx.getResponse(), responseBody, httpStatus)
  }
}
