import { UserDocument } from 'src/auth/shared/schema/user.schema';

declare global {
  namespace Express {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface User extends UserDocument {}
  }
}
