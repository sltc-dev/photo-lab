export function isTrustedRendererUrl(
  value: string,
  developmentRendererUrl: string | undefined,
  productionRendererUrl: string,
): boolean {
  try {
    const candidate = new URL(value);

    if (developmentRendererUrl) {
      // 开发服务器的具体路径可能变化，但必须保持同一个 origin。
      return candidate.origin === new URL(developmentRendererUrl).origin;
    }

    // 生产页面使用 file URL；路由 hash 和查询参数不影响入口文件身份。
    candidate.hash = '';
    candidate.search = '';
    return candidate.href === productionRendererUrl;
  } catch {
    return false;
  }
}
