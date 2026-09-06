import { Controller, Get } from '@nestjs/common'
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiServiceUnavailableResponse,
} from '@nestjs/swagger'
import {
  HealthCheck,
  HealthCheckService,
  TypeOrmHealthIndicator,
  MemoryHealthIndicator,
  type HealthCheckResult,
} from '@nestjs/terminus'
import { Public } from '@/auth/auth.decorator'

/**
 * Readiness probe used by orchestrators/load balancers to determine
 * whether this instance can safely receive traffic. Unlike the plain
 * `GET /` liveness ping, this checks that the service's actual
 * dependencies (database connectivity, memory pressure) are healthy.
 */
@Public()
@ApiTags('app')
@Controller()
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: TypeOrmHealthIndicator,
    private readonly memory: MemoryHealthIndicator,
  ) {}

  @Get('health')
  @HealthCheck()
  @ApiOperation({
    summary: 'Readiness check',
    description:
      'Verifies the service and its dependencies (MySQL database connectivity, memory usage) are healthy. Intended for load balancer / orchestrator readiness probes, not for end users.',
  })
  @ApiOkResponse({ description: 'All dependencies are healthy.' })
  @ApiServiceUnavailableResponse({
    description: 'One or more dependencies are unhealthy.',
  })
  check(): Promise<HealthCheckResult> {
    return this.health.check([
      () => this.db.pingCheck('database', { timeout: 3000 }),
      () => this.memory.checkHeap('memory_heap', 300 * 1024 * 1024),
      () => this.memory.checkRSS('memory_rss', 500 * 1024 * 1024),
    ])
  }
}
