<p align="center">
  <img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" />
</p>

# Cars API Server

A NestJS-based backend for managing cars, brands, products, users, orders, and more.  
This project is structured for scalability, modularity, and maintainability.

---

## Features

- Modular architecture (brands, products, users, orders, etc.)
- File upload support (brands, carousel, categories, products, orders)
- JWT authentication and role-based access control
- Internationalization (i18n) support
- Email notifications
- RESTful API design
- Environment-based configuration

---

## Project Setup

```bash
npm install
```

## Running the Project

```bash
# Development
npm run start

# Watch mode (auto-reload)
npm run start:dev

# Production mode
npm run start:prod
```

## Testing

```bash
# Unit tests
npm run test

# End-to-end tests
npm run test:e2e

# Test coverage
npm run test:cov
```

## Environment Variables

Create a `.env` file in the root directory and configure the following variables as needed:

```
PORT=3000
DATABASE_URL=your_database_url
JWT_SECRET=your_jwt_secret
UPLOADS_PATH=uploads/
CORS_ORIGIN=your_frontend_url
EMAIL_USER=your_email_user
EMAIL_PASS=your_email_password
```

## Project Structure

- `src/` - Main source code
  - `auth/` - Authentication and authorization
  - `brands/` - Brand management
  - `carousel/` - Carousel image management
  - `cart/` - Shopping cart logic
  - `categories/` - Category management
  - `coupons/` - Coupon management
  - `email/` - Email sending and templates
  - `file-upload-in-diskStorage/` - File upload utilities
  - `order/` - Order management
  - `products/` - Product management
  - `promo-banner/` - Promotional banners
  - `shared/` - Shared utilities, pipes, constants, base services
  - `types/` - Custom TypeScript types and interfaces
  - `users/` - User management
  - `i18n/` - Internationalization resources
- `uploads/` - Uploaded files (created at runtime)
- `test/` - Test files

## Deployment

For deployment instructions, see the [NestJS deployment documentation](https://docs.nestjs.com/deployment).  
You can deploy to any Node.js-compatible hosting or cloud provider.

## Resources

- [NestJS Documentation](https://docs.nestjs.com)
- [NestJS Discord](https://discord.gg/G7Qnnhy)
- [NestJS Devtools](https://devtools.nestjs.com)
- [NestJS Jobs board](https://jobs.nestjs.com)

## License

This project is [MIT licensed](LICENSE)