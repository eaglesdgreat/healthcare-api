import { Module } from '@nestjs/common'
import { APP_INTERCEPTOR } from '@nestjs/core'
import { MetricsService } from './metrics.service'
import { MetricsController } from './metrics.controller'
import { MetricsInterceptor } from './metrics.interceptor'

/**
 * Provides the Prometheus metrics registry, the `/metrics` scrape
 * endpoint, and a global interceptor that records HTTP request
 * count/latency for every request.
 *
 * Import this module wherever `MetricsService` needs to be injected
 * (e.g. AuthModule, to record auth-domain metrics) in addition to
 * AppModule, which wires up the `/metrics` endpoint and the interceptor.
 */
@Module({
  controllers: [MetricsController],
  providers: [
    MetricsService,
    {
      provide: APP_INTERCEPTOR,
      useClass: MetricsInterceptor,
    },
  ],
  exports: [MetricsService],
})
export class MetricsModule {}
