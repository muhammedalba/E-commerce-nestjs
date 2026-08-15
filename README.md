<p align="center">
  <img src="https://nestjs.com/img/logo-small.svg" width="100" alt="NestJS Logo" />
</p>

<h1 align="center">SkyGalaxy — REST API Server</h1>

<p align="center">
  A production-ready, modular NestJS backend powering the SkyGalaxy e-commerce platform.<br/>
  Built with TypeScript, MongoDB, BullMQ, JWT authentication, and i18n support.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/NestJS-v10-E0234E?logo=nestjs&logoColor=white" />
  <img src="https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white" />
  <img src="https://img.shields.io/badge/MongoDB-Mongoose-47A248?logo=mongodb&logoColor=white" />
  <img src="https://img.shields.io/badge/BullMQ-Redis-DC382D?logo=redis&logoColor=white" />
  <img src="https://img.shields.io/badge/License-MIT-green" />
</p>

---

## Table of Contents

- [Features](#features)
- [Architecture Overview](#architecture-overview)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [API Overview](#api-overview)
- [Security](#security)
- [Running Tests](#running-tests)
- [Deployment](#deployment)

---

## Features

| Category | Details |
|---|---|
| **Authentication** | JWT access & refresh tokens, Google OAuth2, Facebook OAuth2, secure httpOnly cookies |
| **Authorization** | Role-based (RoleGuard) + Permission-based (PermissionsGuard) access control |
| **Security** | Helmet, CORS allowlist, Rate limiting (Throttler), sameSite cookie protection, Refresh Token Rotation with theft detection |
| **Background Jobs** | BullMQ + Redis — email queues, async processing |
| **File Uploads** | Multer disk storage with type/size validation and automatic rollback on failure |
| **Caching** | NestJS CacheManager with TTL and auto-invalidation interceptors |
| **Internationalization** | nestjs-i18n with Arabic/English support across API responses and emails |
| **Email** | Template-based transactional emails (registration, password reset, order updates) |
| **Audit Logging** | Dedicated audit module for tracking admin actions |
| **Validation** | class-validator + class-transformer with i18n error messages |

---

## Architecture Overview

```
src/
├── auth/               # Authentication, JWT, OAuth2, Guards
├── users/              # User management
├── roles/              # Role & Permission management
├── products/           # Product catalog
├── brands/             # Brand management
├── categories/         # Product categories
├── sub-category/       # Sub-category management
├── cart/               # Shopping cart
├── order/              # Order lifecycle management
├── checkout/           # Checkout & payment processing
├── payments/           # Payment integration
├── coupons/            # Discount & coupon system
├── carousel/           # Homepage carousel
├── promo-banner/       # Promotional banners
├── supplier/           # Supplier management
├── locations/          # Delivery locations
├── shipping/           # Shipping rules
├── taxes/              # Tax configuration
├── settings/           # App-wide settings
├── notifications/      # Push/in-app notifications
├── audit/              # Admin audit logging
├── email/              # Email templates & queue processor
├── seed/               # Database seeding
├── file-upload/        # Shared file upload service
├── shared/             # Guards, interceptors, decorators, filters, base services
├── config/             # Environment, DB, JWT, i18n, BullMQ configuration
└── i18n/               # Translation files (ar / en)
```

---

## Getting Started

### Prerequisites

- **Node.js** >= 18.x
- **MongoDB** >= 6.x
- **Redis** >= 7.x (required for BullMQ job queues)

### Installation

```bash
npm install
```

### Running the Server

```bash
# Development (single run)
npm run start

# Development with hot-reload (recommended)
npm run start:dev

# Production
npm run start:prod
```

The server starts on `http://localhost:3000` by default.  
All routes are prefixed with `/api/v1`.

---

## Environment Variables

Create a `.env` file in the root directory. All variables are validated on startup via `class-validator`.

```env
# ── App ──────────────────────────────────────────
NODE_ENV=development
PORT=3000
BASE_URL=http://localhost:3000
CLIENT_URL=http://localhost:5173
UPLOADS_FOLDER=uploads

# ── Database ─────────────────────────────────────
DATABASE_URL=mongodb://localhost:27017/skygalaxy

# ── JWT ──────────────────────────────────────────
JWT_SECRET=your_strong_secret_key
JWT_EXPIRE_TIME=1d
JWT_REFRESH_TOKEN_EXPIRE_TIME=7

# ── Redis / BullMQ ───────────────────────────────
REDIS_HOST=localhost
REDIS_PORT=6379

# ── Email (SMTP) ─────────────────────────────────
MAIL_HOST=smtp.example.com
MAIL_PORT=587
MAIL_USERNAME=your@email.com
MAIL_PASSWORD=your_password
MAIL_FROM=no-reply@skygalaxy.shop

# ── OAuth2 ───────────────────────────────────────
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=http://localhost:3000/api/v1/auth/google/redirect

FACEBOOK_APP_ID=your_facebook_app_id
FACEBOOK_APP_SECRET=your_facebook_app_secret
FACEBOOK_CALLBACK_URL=http://localhost:3000/api/v1/auth/facebook/redirect
```

---

## API Overview

| Module | Base Route | Auth Required |
|---|---|---|
| Auth | `/api/v1/auth` | Partial |
| Users | `/api/v1/users` | Admin |
| Roles | `/api/v1/roles` | Admin |
| Products | `/api/v1/products` | Partial |
| Brands | `/api/v1/brands` | Partial |
| Categories | `/api/v1/categories` | Partial |
| Cart | `/api/v1/cart` | User |
| Orders | `/api/v1/orders` | User / Admin |
| Checkout | `/api/v1/checkout` | User |
| Coupons | `/api/v1/coupons` | Admin |
| Shipping | `/api/v1/shipping` | Admin |
| Settings | `/api/v1/settings` | Admin |
| Notifications | `/api/v1/notifications` | User |

---

## Security

| Layer | Implementation |
|---|---|
| **HTTP Headers** | `helmet` — sets secure HTTP headers |
| **CORS** | Explicit origin allowlist, `credentials: true` |
| **Rate Limiting** | `@nestjs/throttler` — per-endpoint limits (login: 5/min, register: 3/min, forgot-password: 3/min) |
| **Cookies** | `httpOnly`, `secure` (prod), `sameSite: lax` (access token), `sameSite: strict` (refresh token) |
| **Refresh Tokens** | Rotation with atomic theft detection — a reused token triggers immediate session termination |
| **Password Hashing** | bcrypt via Mongoose pre-save hooks |
| **JWT Invalidation** | `passwordChangeAt` check on every authenticated request |
| **File Uploads** | MIME type whitelist + size limits via Multer |

---

## Running Tests

```bash
# Unit tests
npm run test

# Watch mode
npm run test:watch

# End-to-end tests
npm run test:e2e

# Coverage report
npm run test:cov
```

---

## Deployment

1. Set `NODE_ENV=production` in your environment.
2. Ensure MongoDB and Redis are accessible.
3. Build the production bundle:

```bash
npm run build
```

4. Start the server:

```bash
npm run start:prod
```

> The server binds to `0.0.0.0` and the port specified by `PORT`.

For containerized deployments, a `Dockerfile` can be added targeting the `dist/` output.

---

## License

This project is [MIT licensed](LICENSE).