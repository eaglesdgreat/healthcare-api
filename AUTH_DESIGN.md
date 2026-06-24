# Technical Design Document: Identity & Authentication Service (ms-auth-api)

1. ## Executive Summary

   The Identity & Authentication Service (ms-auth-api) is the central Identity Provider (IdP) for the healthcare microservices ecosystem. It manages user provisioning, federated and local authentication, session management, and role-based access control (RBAC) boundaries for Patients, Doctors, and Hospitals. This version incorporates an out-of-process notification flow, account activation cycles, and specialized client session paradigms for offline-first data synchronization.

2. ## Architectural Goals & Constraints

- **Decoupled Identity:** Downstream services (e.g., Appointment Service) must never query the auth database directly. They rely strictly on cryptographic token verification.

- **Polymorphic Routing Keys:** Support instant user categorization using structural, immutable prefixes (PAT-, DOC-, HOS-).

- **Asynchronous side-effects:** Long-running processes like sending emails, SMS verifications, or push notifications must be decoupled from the core HTTP thread via event-driven messaging.

- **Offline Resilience:** The authentication architecture must natively support token validation boundaries that allow client-side service workers to safely queue actions while offline.

3. ## System Architecture & Context

#### 3.1 Structural System Overview

All external client traffic passes through an API Gateway (Traefik). Core lifecycle actions trigger events published to a central Message Broker, which routes notification requests to an independent Notification Microservice.

```text
[ Client App / Service Worker ]
              │ (HTTPS /auth/*)
              ▼
       [ Traefik Gateway ]
              │
              ▼
     [ ms-auth-api (NestJS) ] ───► [ ms-auth-db (MySQL) ]
              │
              ▼ (Publishes Events)
     [ Message Broker (RabbitMQ/Kafka) ]
              │
              ▼ (Consumes Events)
     [ ms-notification-service ] ───► Third-Party Gateways (Twilio, SendGrid, FCM)
```

#### 3.2 Revised Data Models & Schema Evolution

The database (ms-auth-db) uses a unified users table. Accounts are created in a deactivated state (is_active = false) by default, requiring token verification.

```sql
CREATE TABLE users (
    id VARCHAR(36) PRIMARY KEY,                   -- UUID v4
    health_id VARCHAR(20) UNIQUE,                 -- PAT-, DOC-, HOS- prefixed identifier
    email VARCHAR(255) UNIQUE,
    phone_number VARCHAR(20) UNIQUE,
    password_hash VARCHAR(255) NULL,              -- Nullable for Google OAuth users
    role ENUM('PATIENT', 'DOCTOR', 'HOSPITAL', 'ADMIN') NOT NULL,
    is_active BOOLEAN DEFAULT FALSE,              -- High security default
    activation_token VARCHAR(255) NULL,           -- Hashed OTP or random verification key
    activation_expires_at TIMESTAMP NULL,         -- Strict TTL window for activation
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
 [ Emit: user.pending_activation ] ──► (Picked up by Notification Service)
                                                 │
                                                 ▼
                                     (Sends Email/SMS to User)
                                                 │
          ┌──────────────────────────────────────┘
          ▼
[ Client hits /auth/activate?token=... ]
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

2. **Event Dispatched:** ms-auth-api publishes a user.pending_activation event containing user metadata and the token.

3. **Notification Consumption:** The ms-notification-service consumes the event and dispatches an Email (via SendGrid), an SMS (via Twilio), or a Push Notification (via Firebase Cloud Messaging) based on the user's preferred contact method.

4. **Activation:** The user submits the token to POST /auth/activate. Upon validation, is_active is updated to true, the token is cleared, and an integration event user.registered is published to notify downstream domain services (Patient, Doctor, Hospital) to safely provision empty profiles mapped to that health_id.

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

1. The client identity layer transmits an openID Connect id_token obtained from Google to POST /auth/google.

2. ms-auth-api cross-verifies the cryptographic token signature against Google's public JSON Web Key Sets (JWKS).

3. If the email exists and matches an activated account, a native system JWT is immediately issued.

4. If the email is unknown, the application provisions a new inactive user, triggers the specific role assignment step, updates the database, and publishes the account creation hooks.

#### 4.4 Offline-First & Service Worker Architecture

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

This completed design block can be written directly to your project root as DESIGN_AUTH.md. It perfectly outlines your decoupled service structures.

Now that this is fully documented, shall we proceed with the Technical Design Document for the Medical Appointment Microservice Architecture?
