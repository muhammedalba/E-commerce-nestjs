import { User } from 'src/auth/shared/schema/user.schema';

declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}
