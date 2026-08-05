//凭借可访问的真实url路径
export function buildPublicUrl(objectKey: string): string {
  const encodedObjectKey = objectKey.split('/').map(encodeURIComponent).join('/');

  return `/public/${encodedObjectKey}`;
}
