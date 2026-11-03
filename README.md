<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Project setup

```bash
$ pnpm install
```

## Compile and run the project

```bash
# development
$ pnpm run start

# watch mode
$ pnpm run start:dev

# production mode
$ pnpm run start:prod
```

## Run tests

Integration and end-to-end tests use MySQL. Make sure your local database is running before you run the integration or e2e commands. E2E tests use the application migrations rather than TypeORM schema synchronization; apply migrations before running them. The E2E suites share the application's database connection without dropping schemas, and the auth E2E suite mocks the notification client so tests do not require a live notification service.

```bash
# unit tests
$ pnpm run test:unit

# integration tests
$ pnpm run test:integration

# e2e tests
$ NODE_ENV=dev pnpm run migrate:up --env=dev
$ pnpm run test:e2e

# test coverage
$ pnpm run test:cov
```

### Run tests locally against MySQL

```bash
$ make test-mysql
```

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ pnpm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).

# 🏗 System Architecture: Identity & Auth Flow

### 1. Unified Identity System (The Global Health ID)

We use a prefixed identification system to categorize users across the ecosystem. This allows the system to route logic based on the entity type immediately upon entry.

PAT-XXXXXX: Patients (Medical History, Personal Records)

DOC-XXXXXX: Doctors (Consultations, Prescriptions)

HOS-XXXXXX: Hospitals (Facility Management, Appointments)

### 2. Authentication Flow (Auth Service)

This service implements a registration -> activation -> login flow and acts as the Identity Provider (IdP) for the ecosystem.

Sign-Up

- Validation: Incoming registration requests are validated with class-validator (see RegisterUserDto).
- ID Generation: A prefixed Health ID (PAT-, DOC-, HOS-) is generated based on the chosen role.
- Security: Passwords are hashed using bcrypt before being persisted.
- Activation: Newly registered users are created as inactive (isActive = false). Auth registers the email address with the notification service and enqueues an activation email. The token is SHA-256 hashed in auth storage and AES-256-GCM encrypted in the notification payload.

Endpoints (Auth service)

- POST /signup
  - Body: RegisterUserDto
  - Behaviour: creates an inactive user and queues an encrypted activation email through the internal notification API. A `202` means queued, not delivered.

- POST /activate
  - Body: { healthId: string, token: string }
  - Behaviour: validates the token and expiry for the provided healthId and, on success, activates the user (sets isActive = true and clears the activation fields).

- POST /refresh
  - Body: { refreshToken: string }
  - Behaviour: validates a persisted refresh token, rotates it, and issues a new access token and refresh token.

- POST /logout
  - Body: { refreshToken: string }
  - Behaviour: revokes the provided refresh token so it can no longer be used.

- POST /google
  - Body: GoogleSignInDto (idToken + optional role)
  - Behaviour: verifies a Google ID token, signs in an existing active account or provisions a new inactive account and queues an activation email.

#### Sign-In

- Multi-Identifier Input: Users can log in using any of Email, Phone Number, or Health ID.
- Normalization rules (implemented in LoginUserDto and used by the service):
  - Email: trimmed and lowercased before lookup.
  - Phone number: trimmed before lookup.
  - Health ID: trimmed and uppercased before lookup.

These normalization rules ensure consistent lookups across registrations and logins.

Authentication tokens

- JWT payload contains: sub (user UUID), healthId, roles, and a tokenType discriminator. Contact details are not copied into JWT claims.
- Access token: expires in 15 minutes (used to access protected APIs).
- Refresh token: expires in 7 days and is persisted so the service can revoke or rotate refresh tokens.

Activation token delivery

- Activation tokens are generated with crypto.randomBytes, hashed before storage, and stored with a 24-hour expiry.
- Signup, Google provisioning, and resend register the user's email channel at `POST /api/notifications/channels` and enqueue `auth-account-activation` at `POST /api/notifications`.
- Requests use the shared service API key, an `Idempotency-Key`, and the incoming `x-request-id`. The token is encrypted using AES-256-GCM before it is sent to or persisted by the notification service.

### 3. Cross-Service Communication

The Auth Service is the Identity Provider (IdP) for other microservices. Activation delivery uses synchronous internal REST to enqueue work; email delivery is asynchronous in the notification worker.

#### A. Synchronous (Internal API Gateway / Traefik)

- When a request hits downstream services, the service extracts and verifies the JWT signature (shared secret or public key).
- Downstream services should use the healthId and role from the token to apply authorization rules and filter data.

#### B. Notifications and observability

- Configure `NOTIFICATION_SERVICE_URL`, `NOTIFICATION_SERVICE_API_KEY` (at least 32 bytes), and `NOTIFICATION_PAYLOAD_ENCRYPTION_KEY` (base64-encoded 32-byte AES key) in auth. The notification service uses the same key values as `NOTIFICATION_API_KEY` and `NOTIFICATION_PAYLOAD_ENCRYPTION_KEY`.
- Production notification URLs must use HTTPS and should be reachable only on the private service network. Store all keys in a secrets manager; never hardcode credentials.
- Auth emits structured `auth.activity` JSON logs to stdout. Alloy collects container stdout and forwards logs to Loki; the observability service has no direct auth event-ingest API.
- Notification enqueue failures return an error and are logged without token, email, or API-key values. A successful `202` is queue acceptance only; query notification status or monitor delivery logs for completion.

### 4. Security & Data Integrity

- Input Protection: Health IDs and credentials are validated with strict regexes to prevent injection and malformed IDs.
- Database access uses TypeORM repository methods with bound parameters; never interpolate request values into SQL. User-controlled profile fields are returned as data and must be escaped by clients; do not render them as raw HTML.
- Self-service signup and Google provisioning cannot assign the ADMIN role.
- Google identity tokens do not reliably include a phone number; the users schema now permits a null phone number for these accounts. Apply the new phone-number-nullability migration before deploying this version.
- Activation tokens are 256-bit random values stored only as SHA-256 hashes, compared in constant time, and rejected when expiry is missing or elapsed. Refresh tokens are hashed at rest and atomically revoked during rotation; access tokens cannot be used as refresh tokens.
- Request bodies and query-bearing request URLs are excluded from HTTP logs. Auth audit logs/events never include passwords, bearer tokens, refresh tokens, Google ID tokens, or activation tokens.
- Rate Limiting: Configure Traefik-level rate limits for login and activation endpoints to mitigate brute-force attacks. Keep limits enabled in production.
- Audit Trail: Successful and failed authentication actions emit safe `auth.activity` structured logs, collected by Alloy and stored in Loki. Logs include the request ID for correlation and exclude secrets and contact data.
- Token Revocation: Refresh tokens are persisted as hashes and atomically revoked during rotation or logout. Access tokens remain short-lived JWTs.

### 5. Development Workflow (Docker)

This project uses Docker Compose for a "Hot-Reload" environment. Key points:

- Dev build: docker-compose targets the `base` stage so the service runs with a bind mount and watch mode for fast feedback.
- Startup sequence: docker-compose runs a wait-for script to ensure the database is reachable, runs migrations (db-migrate up -e dev) and starts NestJS in watch mode.
- Environment: Provide environment variables via a local `.env` file (MYSQL_HOST, MYSQL_PORT, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE, JWT_SECRET, GOOGLE_CLIENT_ID, NOTIFICATION_SERVICE_URL, NOTIFICATION_SERVICE_API_KEY, NOTIFICATION_PAYLOAD_ENCRYPTION_KEY). Never commit `.env`; production credentials must come from a secrets manager.
- Commands:
  - Local dev: pnpm install; make start (uses docker-compose up -d)
  - Build release: make build-release (uses the Makefile to build the `release` Docker image)
  - Run migrations: make migrate (executes db-migrate inside the container)

Testing & Building

- Use pnpm run build to compile TypeScript into dist/ (required by the production Docker image).
- Run tests with pnpm run test:unit (unit) and pnpm run test:e2e for E2E tests. Integration and E2E tests require MYSQL_USER and MYSQL_PASSWORD to be supplied through the environment.

Deployment notes

- Keep TypeORM synchronize = false in production (migrations are used).
- Secure JWT_SECRET and database credentials using a secrets manager in production.
- Production requires `JWT_SECRET` and `NOTIFICATION_SERVICE_API_KEY` to contain at least 32 bytes, `NOTIFICATION_PAYLOAD_ENCRYPTION_KEY` to decode to exactly 32 bytes, and an HTTPS `NOTIFICATION_SERVICE_URL`. Google sign-in requires `GOOGLE_CLIENT_ID`.
- Centralized structured logs are collected from Docker stdout by Alloy and stored in Loki. Restrict log access and retention according to the platform's data-protection policy.

If you update the code that affects the behavior documented above (for example token lifetimes, endpoint names, or payload contents), update this README accordingly so future maintainers have a single source of truth.

### 6. Observability and diagnostics

This service emits structured Pino logs and Prometheus metrics so it can be operated consistently with the other healthcare microservices. Logs include a request correlation ID (`x-request-id`), which is returned to callers and should be supplied when reporting an issue. Request bodies, query-bearing URLs, authentication headers, cookies, and API keys are redacted before a log is emitted. Auth activity is written to stdout without credentials, tokens, contact details, or profile data. Alloy collects container logs and forwards them to Loki. Raw exception objects are not logged by the auth flow.

| Endpoint       | Authentication                                      | Purpose                                                                                                                                                                  |
| -------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `GET /health`  | Public                                              | Readiness probe. It verifies MySQL connectivity and configured heap/RSS memory limits. Returns `200` only when the instance can accept traffic; returns `503` otherwise. |
| `GET /metrics` | Public; restrict it at the gateway or network layer | Prometheus text-format metrics for service/process health, HTTP request count/latency, and authentication outcomes.                                                      |
| `GET /api`     | Public                                              | Swagger UI, including endpoint descriptions and success/failure response examples.                                                                                       |

The health endpoint accepts no request body. A healthy response is:

```json
{
  "status": "ok",
  "info": {
    "database": { "status": "up" },
    "memory_heap": { "status": "up" },
    "memory_rss": { "status": "up" }
  },
  "error": {},
  "details": {}
}
```

All HTTP failures use a common response envelope. Keep the `requestId` when escalating an issue; it links the client-visible error to the structured logs.

```json
{
  "type": "Invalid credentials",
  "statusCode": 401,
  "timestamp": "2026-09-07T10:15:30.000Z",
  "path": "/login",
  "requestId": "7a1b2c3d-4e5f-6789-abcd-ef0123456789",
  "response": { "message": "Invalid credentials", "statusCode": 401 }
}
```

Do not expose `/metrics` directly to the public internet in production. Permit only the Prometheus scraper, service network, or an authenticated gateway route to access it.
