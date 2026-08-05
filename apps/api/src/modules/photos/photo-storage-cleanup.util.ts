import type { Logger } from '@nestjs/common';
import type { StorageService } from '../storage/storage.service';

export async function removeStoredObjects(
  storageService: StorageService,
  objectKeys: string[],
  logger: Logger,
): Promise<void> {
  const cleanupResults = await Promise.allSettled(
    objectKeys.map((objectKey) => storageService.removeObject(objectKey)),
  );

  cleanupResults.forEach((result, index) => {
    if (result.status === 'rejected') {
      const objectKey = objectKeys[index];
      const cleanupError = result.reason;

      logger.error(
        `Failed to remove orphaned upload objectKey=${objectKey}`,
        cleanupError instanceof Error ? cleanupError.stack : String(cleanupError),
      );
    }
  });
}
