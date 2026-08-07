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

Integration and end-to-end tests use MySQL. Make sure your local database is running before you run the integration or e2e commands.

```bash
# unit tests
$ pnpm run test:unit

# integration tests
$ pnpm run test:integration

# e2e tests
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
- Activation: Newly registered users are created as inactive (isActive = false). An activationToken (random hex string) and activationExpiresAt (24 hours) are generated and saved on the user record. The service returns a success message and emits a placeholder event so an external notification service (email/SMS) can deliver the token.

Endpoints (Auth service)

- POST /signup
  - Body: RegisterUserDto
  - Behaviour: creates an inactive user, generates activationToken and activationExpiresAt, returns a message indicating activation is required. The activation token should be delivered to the user via an external notification (email/SMS).

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
  - Behaviour: verifies a Google ID token, signs in an existing active account or provisions a new inactive account and emits an activation event.

#### Sign-In

- Multi-Identifier Input: Users can log in using any of Email, Phone Number, or Health ID.
- Normalization rules (implemented in LoginUserDto and used by the service):
  - Email: trimmed and lowercased before lookup.
  - Phone number: trimmed before lookup.
  - Health ID: trimmed and uppercased before lookup.

These normalization rules ensure consistent lookups across registrations and logins.

Authentication tokens

- JWT payload contains: sub (user UUID), healthId, role, email, phoneNumber.
- Access token: expires in 15 minutes (used to access protected APIs).
- Refresh token: expires in 7 days and is persisted so the service can revoke or rotate refresh tokens.

Notes on Activation token

- Activation tokens are generated with crypto.randomBytes, hashed before storage, and stored with a 24-hour expiry.
- The service includes a placeholder to emit a 'user.pending_activation' event when a user signs up. Integrate this with an email/SMS delivery service or an event bus for production use.

### 3. Cross-Service Communication

The Auth Service is the Identity Provider (IdP) for other microservices. Communication follows these patterns:

#### A. Synchronous (Internal API Gateway / Traefik)

- When a request hits downstream services, the service extracts and verifies the JWT signature (shared secret or public key).
- Downstream services should use the healthId and role from the token to apply authorization rules and filter data.

#### B. Asynchronous (Event-Driven)

- On user creation the Auth Service emits events (placeholder name: user.registered / user.pending_activation). Consumers such as the Patient Service can react to create EHR records or send notifications.
- An optional external event bus can be enabled by setting `EVENT_BUS_URL`; events will be posted to that broker URL in addition to the in-process emitter.

### 4. Security & Data Integrity

- Input Protection: Health IDs and credentials are validated with strict regexes to prevent injection and malformed IDs.
- Rate Limiting: Traefik-level rate limiting is recommended to protect login and activation endpoints from brute-force attacks. Consider adding server-side rate limiting (NestJS Throttler) for defense in depth.
- Audit Trail: Authentication attempts (successful and failed) should be logged. The container logs are a basic audit trail; for production use push audit logs to a centralized logging system.
- Token Revocation: The service currently issues stateless JWTs. For immediate revocation support consider storing refresh tokens or maintaining a revocation list.

### 5. Development Workflow (Docker)

This project uses Docker Compose for a "Hot-Reload" environment. Key points:

- Dev build: docker-compose targets the `base` stage so the service runs with a bind mount and watch mode for fast feedback.
- Startup sequence: docker-compose runs a wait-for script to ensure the database is reachable, runs migrations (db-migrate up -e dev) and starts NestJS in watch mode.
- Environment: Provide environment variables via a .env file (example keys required: MYSQL_HOST, MYSQL_PORT, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE, JWT_SECRET).
- Commands:
  - Local dev: pnpm install; make start (uses docker-compose up -d)
  - Build release: make build-release (uses the Makefile to build the `release` Docker image)
  - Run migrations: make migrate (executes db-migrate inside the container)

Testing & Building

- Use pnpm run build to compile TypeScript into dist/ (required by the production Docker image).
- Run tests with pnpm run test (unit) and pnpm run test:e2e for E2E tests.

Deployment notes

- Keep TypeORM synchronize = false in production (migrations are used).
- Secure JWT_SECRET and database credentials using a secrets manager in production.
- Consider adding centralized logging and monitoring for auditability and alerting.

If you update the code that affects the behavior documented above (for example token lifetimes, endpoint names, or payload contents), update this README accordingly so future maintainers have a single source of truth.
