import { Controller, Get, Header } from '@nestjs/common'
import {
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger'
import { Public } from '@/auth/auth.decorator'
import { MetricsService } from './metrics.service'

/**
 * Exposes Prometheus text-exposition metrics for scraping.
 */
@Public()
@ApiTags('observability')
@Controller()
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get('metrics')
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  @ApiOperation({
    summary: 'Prometheus metrics scrape',
    description:
      'Returns Prometheus text-format service, process, HTTP, and authentication metrics. This public endpoint is intended for an internal Prometheus scraper and accepts no request body.',
  })
  @ApiProduces('text/plain; version=0.0.4; charset=utf-8')
  @ApiOkResponse({
    description:
      'A Prometheus text exposition document. The exact metric values change at runtime.',
    schema: {
      type: 'string',
      example:
        '# HELP http_requests_total Total number of HTTP requests processed\n# TYPE http_requests_total counter\nhttp_requests_total{method="GET",route="/health",status_code="200"} 1',
    },
  })
  async getMetrics(): Promise<string> {
    return this.metricsService.registry.metrics()
  }
}
