import { isValidObjectId, Types } from 'mongoose';

/**
 * Safely converts a string or ObjectId to a proper mongoose Types.ObjectId.
 * If the input is already a valid ObjectId string/instance, it converts it.
 * Otherwise, it returns the value as-is (useful for non-standard IDs).
 *
 * @param id - The ID to normalize (string or ObjectId).
 * @returns A Types.ObjectId instance if valid, or the original value.
 */
export function toObjectId(
  id: string | Types.ObjectId,
): Types.ObjectId | string {
  return isValidObjectId(id) ? new Types.ObjectId(id) : id;
}
