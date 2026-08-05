const MAX_STORAGE_FILE_NAME_BYTES = 255;

export function buildOriginalObjectKey(
  projectId: string,
  photoId: string,
  fileName: string,
): string {
  const uniquePrefix = `${photoId}--`;
  const availableFileNameBytes =
    MAX_STORAGE_FILE_NAME_BYTES - Buffer.byteLength(uniquePrefix, 'utf8');
  const storageFileName = truncateFileName(fileName, availableFileNameBytes);

  return `projects/${projectId}/photos/${uniquePrefix}${storageFileName}`;
}

export function getFileNameBase(fileName: string): string {
  const extensionStart = fileName.lastIndexOf('.');

  return extensionStart > 0 ? fileName.slice(0, extensionStart) : fileName;
}

function truncateFileName(fileName: string, maxBytes: number): string {
  if (Buffer.byteLength(fileName, 'utf8') <= maxBytes) {
    return fileName;
  }

  const extensionStart = fileName.lastIndexOf('.');
  const extension = extensionStart > 0 ? fileName.slice(extensionStart) : '';

  if (Buffer.byteLength(extension, 'utf8') >= maxBytes) {
    return truncateUtf8(fileName, maxBytes);
  }

  const baseName = extension ? fileName.slice(0, extensionStart) : fileName;

  return `${truncateUtf8(baseName, maxBytes - Buffer.byteLength(extension, 'utf8'))}${extension}`;
}

function truncateUtf8(value: string, maxBytes: number): string {
  let bytes = 0;
  let result = '';

  for (const character of value) {
    const characterBytes = Buffer.byteLength(character, 'utf8');

    if (bytes + characterBytes > maxBytes) {
      break;
    }

    bytes += characterBytes;
    result += character;
  }

  return result;
}
