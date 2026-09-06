import { Injectable, OnModuleInit } from '@nestjs/common'
import {
  Counter,
  Histogram,
  Registry,
  collectDefaultMetrics,
} from 'prom-client'

/**
 * Central Prometheus metrics registry for the service.
 *
 * Exposes generic HTTP metrics (recorded by MetricsInterceptor) and
 * auth-domain metrics (login/signup/refresh/activation outcomes) so
 * operators can alert on abnormal failure rates - for example, a sudden
 * spike in login failures can indicate a credential-stuffing attack, and
 * a spike in 5xx responses can indicate a downstream/database outage.
 */
@Injectable()
export class MetricsService implements OnModuleInit {
  readonly registry = new Registry()

  readonly httpRequestsTotal = new Counter({
    name: 'http_requests_total',
    help: 'Total number of HTTP requests processed',
    labelNames: ['method', 'route', 'status_code'],
    registers: [this.registry],
  })

  readonly httpRequestDurationSeconds = new Histogram({
    name: 'http_request_duration_seconds',
    help: 'Duration of HTTP requests in seconds',
    labelNames: ['method', 'route', 'status_code'],
    buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 2, 5],
    registers: [this.registry],
  })

  readonly authLoginTotal = new Counter({
    name: 'auth_login_attempts_total',
    help: 'Total number of login attempts, labeled by outcome',
    labelNames: ['result'],
    registers: [this.registry],
  })

  readonly authSignupTotal = new Counter({
    name: 'auth_signup_total',
    help: 'Total number of signup attempts, labeled by outcome',
    labelNames: ['result'],
    registers: [this.registry],
  })

  readonly authActivationTotal = new Counter({
    name: 'auth_activation_total',
    help: 'Total number of account activation attempts, labeled by outcome',
    labelNames: ['result'],
    registers: [this.registry],
  })

  readonly authTokenRefreshTotal = new Counter({
    name: 'auth_token_refresh_total',
    help: 'Total number of refresh token rotations, labeled by outcome',
    labelNames: ['result'],
    registers: [this.registry],
  })

  onModuleInit(): void {
    collectDefaultMetrics({ register: this.registry })
  }
}
