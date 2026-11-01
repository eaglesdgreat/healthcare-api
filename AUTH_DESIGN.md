# Technical Design Document: Identity & Authentication Service (ms-auth-api)

1. ## Executive Summary

   The Identity & Authentication Service (ms-auth-api) is the central Identity Provider (IdP) for the healthcare microservices ecosystem. It manages user provisioning, federated and local authentication, session management, and role-based access control (RBAC) boundaries for Patients, Doctors, and Hospitals. This version incorporates an out-of-process notification flow, account activation cycles, and specialized client session paradigms for offline-first data synchronization.

2. ## Architectural Goals & Constraints

- **Decoupled Identity:** Downstream services (e.g., Appointment Service) must never query the auth database directly. They rely strictly on cryptographic token verification.

- **Polymorphic Routing Keys:** Support instant user categorization using structural, immutable prefixes (PAT-, DOC-, HOS-).

- **Asynchronous side-effects:** Auth calls the notification service's internal REST API to enqueue delivery; the notification service performs provider delivery asynchronously.

- **Offline Resilience:** The authentication architecture must natively support token validation boundaries that allow client-side service workers to safely queue actions while offline.

3. ## System Architecture & Context

#### 3.1 Structural System Overview

All external client traffic passes through an API Gateway (Traefik). Auth uses the notification service's authenticated REST API for activation messages. Auth activity logs go to stdout and are collected by the observability stack.

```text
[ Client App / Service Worker ]
              │ (HTTPS /auth/*)
              ▼
       [ Traefik Gateway ]
              │
              ▼
     [ ms-auth-api (NestJS) ] ───► [ ms-auth-db (MySQL) ]
              │
              ├── REST + API key + encrypted payload
              ▼
     [ Notification API ] ───► [ BullMQ / Redis ] ───► [ SendGrid ]
              │
              └── safe structured stdout logs
                         │ Docker stdout
                         ▼
              [ Alloy ] ───► [ Loki ]
```

#### 3.2 Revised Data Models & Schema Evolution

The database (ms-auth-db) uses a unified users table. Accounts are created in a deactivated state (is_active = false) by default, requiring token verification. Phone numbers are nullable so Google accounts without a phone claim can be provisioned without inventing a placeholder value.

```sql
CREATE TABLE users (
    id VARCHAR(36) PRIMARY KEY,                   -- UUID v4
    health_id VARCHAR(20) UNIQUE,                 -- PAT-, DOC-, HOS- prefixed identifier
    email VARCHAR(255) UNIQUE,
    phone_number VARCHAR(20) NULL UNIQUE,
    password_hash VARCHAR(255) NULL,              -- Nullable for Google OAuth users
    role ENUM('PATIENT', 'DOCTOR', 'HOSPITAL', 'ADMIN') NOT NULL,
    is_active BOOLEAN DEFAULT FALSE,              -- High security default
    activation_token VARCHAR(255) NULL,           -- Hashed OTP or random verification key
    activation_expires_at TIMESTAMP NULL,         -- Strict TTL window for activation
    last_activation_sent_at TIMESTAMP NULL,       -- Cooldown anchor for resending activation codes
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
CREATE INDEX idx_users_auth_lookup ON users (email, phone_number, health_id);
CREATE INDEX idx_activation_token ON users (activation_token);
```

4. ## Component Design & System Flows

#### 4.1 Registration & Account Activation Lifecycle

When a user signs up using credentials or Google OAuth2, they are placed in a holding state until verification occurs.

```text
[ Client Sign-Up ]
          │
          ▼
 [ Create Inactive User ] ──► [ Generate Activation Token ]
          │
          ▼
 [ Register email channel + enqueue activation ]
                     │
                     ▼
          [ Notification API returns 202 ]
                     │
                     ▼
          [ Worker sends plain-text email ]
                                                 │
          ┌──────────────────────────────────────┘
          ▼
[ Client POST /auth/activate { healthId, token } ]
          │
          ▼
 [ Validate Token & Expiry ] ──► [ Flip is_active = true ]
                                         │
                                         ▼
                                [ Emit: user.registered ]
                                         │
                                         ▼
                                (Downstream Services Profile Init)
```

1. **User Creation:** Record saved with is_active: false and an activation_token expiring in 24 hours.

2. **Notification Enqueued:** ms-auth-api registers the user's email channel and sends an idempotent request to the notification API. The activation token is SHA-256 hashed in the auth database and AES-256-GCM encrypted in transit and at rest in the notification database. It is never written to logs.

3. **Notification Delivery:** The notification API returns `202 Accepted` when queued. Its worker decrypts the payload only to render the `auth-account-activation` plain-text email and sends it through SendGrid. Queue acceptance is not delivery confirmation.

4. **Activation:** The user submits the token to POST /auth/activate. Upon validation, is_active is updated to true, the token is cleared, and an integration event user.registered is published to notify downstream domain services (Patient, Doctor, Hospital) to safely provision empty profiles mapped to that health_id.

Signup, Google onboarding, and resend await channel registration and notification enqueue. Configure `NOTIFICATION_SERVICE_URL`, `NOTIFICATION_SERVICE_API_KEY`, and `NOTIFICATION_PAYLOAD_ENCRYPTION_KEY` in auth. The notification API must use the matching service key and encryption key. In production, use HTTPS and a private service network. Activation lifecycle events remain process-local; they are not sent to the notification or observability services.

#### 4.1.2 Resend Activation Code

If a user's activation token expires before they activate their account, the client can request a new code via **POST /auth/resend-activation**. The endpoint accepts an identifier (email or phone number) and, after validation, issues a fresh activation token with a renewed 24-hour expiry window.

```text
[ Client: token expired ]
          |
          v
 [ POST /auth/resend-activation { identifier } ]
          |
          v
  [ Lookup user by email / phone ]
          |
          +-- exists & active?  -> return already-activated (200)
          +-- unknown?          -> generic 401 (no enumeration)
          +-- within cooldown?  -> 400 "Please wait N seconds"
          +-- valid?            -> regenerate + rehash token, reset 24h TTL,
                                  record last_activation_sent_at
                                   |
                                   v
                     [ Register channel + enqueue encrypted notice ]
                                   |
                                   v
                     (Notification Service delivers new code)
```

1. **Identifier Lookup:** The user is located by email or phone number; unknown accounts return a generic message so the endpoint cannot be used to enumerate registered users. Activation delivery currently requires a stored email address.

2. **Cooldown Guard:** The `last_activation_sent_at` column enforces a resend interval (default 60s) to prevent spamming the user's contact channel.

3. **Token Regeneration:** A new token is generated, SHA-256 hashed (matching signup), and stored alongside a refreshed `activation_expires_at` of +24h. Auth registers the email channel and queues a new notification using a token-derived idempotency key.

#### 4.2 Unified Authentication (Sign-In Engine)

The authentication route accepts a single polymorphic input string (username) that maps to an Email, Phone Number, or Health ID via custom class-validator constraints.

```javascript
// Core database lookup pattern inside AuthService
const user = await this.usersRepository.findOne({
  where: [
    { email: username },
    { phoneNumber: username },
    { healthId: username },
  ],
})

if (!user) throw new UnauthorizedException('Invalid credentials')
if (!user.is_active) throw new ForbiddenException('Account requires activation')
```

#### 4.3 Google Sign-In Integration

1. The client identity layer transmits an OpenID Connect id_token obtained from Google to POST /google.

2. ms-auth-api cross-verifies the cryptographic token signature against Google's public JSON Web Key Sets (JWKS).

3. If the email exists and matches an activated account, a native system JWT is issued and refresh tokens are persisted for rotation.

4. If the email is unknown, the application provisions a new inactive user, queues an encrypted activation email, and requires activation before first use.

#### 4.4 Refresh Token Rotation & Revocation

1. A refresh token is issued as a long-lived JWT and hashed before storage in a dedicated refresh_tokens table.

2. Each refresh request validates both the JWT signature and the persisted refresh token record.

3. Successful refresh rotates the token by revoking the existing refresh record and issuing a new refresh token.

4. Logout revokes the refresh token so it cannot be reused.

#### 4.5 Offline-First & Service Worker Architecture

Since the platform uses an offline-first synchronization strategy, token issuance and lifetime management must support detached clients.

**Client Token Strategies**

- **Active Window:** The frontend application stores the short-lived access token in volatile memory (MemoryStorage).

- **Refresh Tokens:** A highly secured, encrypted refresh token is stored inside an httpOnly, Secure, SameSite=Strict cookie managed by the browser runtime environment.

- **Service Worker Boundary:** When network connectivity drops, the client-side Service Worker intercepts outbound requests. It reads the local state metadata to verify if the token was valid when the connection was lost.

- **Offline Queueing:** If the token timestamp is internally valid, the Service Worker allows the client to commit mutation blocks (e.g., scheduling an offline appointment) into an internal client database storage engine (IndexedDB), flagging them for immediate synchronization once network state transitions back to an online status.

5. ## Distributed Security Architecture
   Cryptographic Baselines: All passwords processed using bcrypt at a workload factor of 12.

Gateway Ingress Defenses: Traefik forces TLS 1.3 protocol requirements and acts as a rate-limiting umbrella protecting auth execution paths from distributed credential stuffing attacks.

Input Sanitization Constraints: Strict structural transformations via class-transformer format identifiers to unified cases (e.g., mapping incoming string variants to standard uppercase values like PAT-12345678) to protect internal lookup algorithms.

6. ## Observability, Monitoring, and Error Diagnostics

The Auth Service produces service-local observability signals that are collected by the shared platform observability stack. This keeps domain context close to the code while enabling cross-service dashboards, alerting, and incident investigation.

#### 6.1 Structured Logging and Audit Events

- The application uses Pino through `nestjs-pino`. Production logs are JSON; local development logs are pretty-printed.
- Every incoming request is assigned an `x-request-id` or reuses the caller-supplied value. The same value is included in the response and structured logs, allowing support staff to correlate an API error with its server-side log entries.
- Sensitive request data is excluded or redacted before logging, including request bodies, authorization headers, cookies, API keys, and request URLs with query strings. Auth error logs contain only an error type, status, and safe route context; raw exception objects are not logged.
- Authentication outcomes are emitted as structured `auth.activity` Pino logs with action, outcome, internal user ID where available, timestamp, and request ID. Logs never include passwords, access/refresh tokens, Google ID tokens, activation tokens, or contact details.
- The observability repository has no event-ingest API. Alloy collects container stdout and forwards JSON logs to Loki; do not make a direct observability HTTP request from auth.
- Activation notices use the notification REST API. Configure a 32-byte-or-longer `NOTIFICATION_SERVICE_API_KEY`, `NOTIFICATION_SERVICE_URL` (HTTPS in production), and base64-encoded 32-byte `NOTIFICATION_PAYLOAD_ENCRYPTION_KEY`. The notification service must use the matching `NOTIFICATION_API_KEY` and encryption key.

#### 6.2 Metrics and Readiness

`GET /health` is a public readiness probe for the gateway, orchestrator, and load balancer. It checks MySQL connectivity with a 3-second timeout, heap usage below 300 MiB, and resident set size (RSS) below 500 MiB. It returns `200` with `status: "ok"` only when every dependency is healthy; otherwise it returns `503` with `status: "error"`. It accepts no request body.

`GET /metrics` exposes Prometheus text-format metrics: default Node.js process metrics, HTTP request count/latency by method, matched route, and status code, and authentication counters labeled by outcome for signup, login, activation, and refresh-token operations. Metrics scraping is excluded from HTTP metrics so polling does not distort service traffic figures.

Both endpoints are unauthenticated to support infrastructure probes. Production ingress must restrict `/metrics` to the Prometheus scraper or private service network; `/health` may be reachable by the load balancer as required.

#### 6.3 Error Response Contract

All HTTP exceptions are formatted by the global exception filter. The response contract is:

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

Expected client errors (4xx) are logged at warning level without a stack trace. Unexpected errors and all 5xx failures are logged at error level with a safe error type and request context, but no raw exception message or stack that could contain user data or secrets. Clients must treat `response` as the underlying Nest error payload and `requestId` as the support correlation key.

#### 6.4 Security Requirements

- Signup and Google onboarding may assign PATIENT, DOCTOR, or HOSPITAL roles only. ADMIN is never self-assignable.
- Google onboarding does not assume a phone number is present in the ID token. The matching schema migration makes `phone_number` nullable; deploy that migration before the new application version.
- New refresh JWTs carry a `tokenType: "refresh"` claim; access JWTs carry `tokenType: "access"`. Legacy refresh tokens remain usable only when their hash is present in the refresh-token store. The refresh endpoint rejects access tokens and performs an atomic conditional revocation before issuing a replacement. Refresh tokens are hashed at rest.
- Activation tokens contain 256 bits of random entropy, are hashed at rest, must have a non-null unexpired expiry, and are compared using a constant-time comparison.
- TypeORM repository APIs are used for database access; do not build SQL by interpolating user-controlled values. Clients must render returned names and other user-controlled text as escaped text, never raw HTML.
- No new runtime package was introduced for this refactor. Keep credentials in environment variables or a secrets manager; production requires a `JWT_SECRET` of at least 32 bytes and the notification integration settings described above.
