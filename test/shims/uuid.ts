// uuid@14 is ESM-only and Jest loads modules as CommonJS; the app only uses
// v4, which Node's built-in crypto provides with the same output format.
import { randomUUID } from 'crypto';

export const v4 = (): string => randomUUID();
