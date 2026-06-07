export function normalizePath(path: string): string {
  return path
    .split('/')
    .map((segment) => {
      if (/^\d+$/.test(segment)) return ':id';
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(segment)) {
        return ':id';
      }
      if (/^\d{4}-\d{2}-\d{2}$/.test(segment)) return ':date';
      if (/^[0-9a-f]{16,}$/i.test(segment)) return ':hash';
      return segment;
    })
    .join('/');
}

export function getUrlParts(rawUrl: string) {
  try {
    const parsed = new URL(rawUrl);

    return {
      host: parsed.host,
      path: parsed.pathname || '/',
      normalizedPath: normalizePath(parsed.pathname || '/'),
      queryParams: Object.fromEntries(parsed.searchParams.entries()),
    };
  } catch {
    return {
      host: 'unknown',
      path: rawUrl,
      normalizedPath: rawUrl,
      queryParams: {},
    };
  }
}
