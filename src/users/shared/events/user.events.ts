export const USER_EVENTS = {
  /** A user account was permanently deleted — dependent modules clean up their data. */
  DELETED: 'user.deleted',
} as const;

export class UserDeletedEvent {
  constructor(public readonly userId: string) {}
}
