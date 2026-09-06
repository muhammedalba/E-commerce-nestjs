import { UserDocument } from 'src/auth/shared/schema/user.schema';

/**
 * TypeScript Declaration Merging for Express namespace.
 *
 * Express defines an empty `Express.User` interface by default (`req.user?: Express.User`).
 * This declaration augments the global `Express` namespace so that `Express.User` extends
 * the application's `UserDocument` Mongoose schema.
 *
 * This provides strong typing and auto-completion for `req.user` across all NestJS
 * controllers, guards, interceptors, and authentication middleware.
 */
declare global {
  namespace Express {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface User extends UserDocument {}
  }
}
