import mongoose from 'mongoose';
import { InternalServerErrorException } from '@nestjs/common';

/**
 * UTILITY: Resilient Transaction Retry Wrapper
 * Implements MongoDB's official recommendations for handling TransientTransactionError
 * and UnknownTransactionCommitResult with exponential backoff.
 */
export async function withTransactionRetry<T>(
  action: (session: mongoose.ClientSession) => Promise<T>,
  connection: mongoose.Connection,
  logger: any,
  maxRetries = 3,
): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const session = await connection.startSession();
    session.startTransaction();

    try {
      const result = await action(session);

      // Dedicated Commit Retry Loop
      while (true) {
        try {
          await session.commitTransaction();
          break; // Commit successful
        } catch (commitError: any) {
          if (
            commitError.hasErrorLabel &&
            commitError.hasErrorLabel('UnknownTransactionCommitResult')
          ) {
            logger.warn(
              'UnknownTransactionCommitResult encountered. Retrying commit...',
            );
            await new Promise((res) => setTimeout(res, 50));
            continue;
          }
          throw commitError; // Throw non-commit-related errors to the outer catch
        }
      }

      return result;
    } catch (error: any) {
      await session.abortTransaction();

      // Retry the entire transaction on transient failures
      if (
        error.hasErrorLabel &&
        error.hasErrorLabel('TransientTransactionError') &&
        attempt < maxRetries
      ) {
        logger.warn(
          `TransientTransactionError. Retrying transaction (Attempt ${attempt + 1}/${maxRetries})...`,
        );
        await new Promise((res) => setTimeout(res, Math.pow(2, attempt) * 100)); // Exponential backoff
        continue;
      }
      throw error;
    } finally {
      session.endSession();
    }
  }
  throw new InternalServerErrorException(
    'Transaction failed after maximum retries due to concurrent load.',
  );
}
