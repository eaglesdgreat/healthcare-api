import { Controller, Get, Header } from '@nestjs/common'
import { ApiExcludeController } from '@nestjs/swagger'
import { Public } from '@/auth/auth.decorator'
import { MetricsService } from './metrics.service'

/**
 * Exposes Prometheus text-exposition metrics for scraping.
 * Excluded from Swagger docs since it's an operational endpoint, not a
 * public API surface.
 */
@ApiExcludeController()
@Public()
@Controller()
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get('metrics')
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  async getMetrics(): Promise<string> {
    return this.metricsService.registry.metrics()
  }
}
