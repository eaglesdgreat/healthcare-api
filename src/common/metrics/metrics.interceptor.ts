import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common'
import { Observable } from 'rxjs'
import { tap } from 'rxjs/operators'
import type { Request, Response } from 'express'
import { MetricsService } from './metrics.service'

/**
 * Records HTTP request counts and latency for every request handled by
 * the application, tagged by method/route/status code, so throughput and
 * error rates can be visualized and alerted on in Prometheus/Grafana.
 */
@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly metricsService: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle()
    }

    const httpContext = context.switchToHttp()
    const request = httpContext.getRequest<Request>()
    const response = httpContext.getResponse<Response>()

    // Skip the metrics endpoint itself so scrapes don't skew the numbers.
    if (request.path === '/metrics') {
      return next.handle()
    }

    const route = this.resolveRoute(request)
    const method = request.method
    const stopTimer = this.metricsService.httpRequestDurationSeconds.startTimer(
      {
        method,
        route,
      },
    )

    const record = (): void => {
      const statusCode = response.statusCode.toString()
      stopTimer({ status_code: statusCode })
      this.metricsService.httpRequestsTotal.inc({
        method,
        route,
        status_code: statusCode,
      })
    }

    return next.handle().pipe(
      tap({
        next: record,
        error: record,
      }),
    )
  }

  private resolveRoute(request: Request): string {
    // Prefer the matched route pattern (e.g. /users/:id) over the raw
    // path so metrics aren't fragmented by dynamic path segments such as
    // user ids.
    const route = request.route as { path?: string } | undefined
    return route?.path || request.path || 'unknown'
  }
}
