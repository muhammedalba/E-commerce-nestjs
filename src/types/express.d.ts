import { UserDocument } from 'src/users/schemas/user.schema';

declare global {
  namespace Express {
    interface Request {
      user?: UserDocument;
    }
  }
}
