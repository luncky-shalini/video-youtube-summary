/**
 * Universal network error utilities.
 * Completely free of Node.js-only imports (such as 'dns', 'net', or 'tls')
 * so this module can be safely imported anywhere across server, edge, and client.
 */

export function isNetworkError(error: unknown): boolean {
  if (!error) return false;
  const msg = String(error instanceof Error ? error.message : error).toLowerCase();
  return (
    msg.includes('fetch failed') ||
    msg.includes('failed to fetch') ||
    msg.includes('connection error') ||
    msg.includes('connecttimeout') ||
    msg.includes('timeout') ||
    msg.includes('enotfound') ||
    msg.includes('econnreset') ||
    msg.includes('econnrefused') ||
    msg.includes('und_err_connect_timeout') ||
    msg.includes('networkerror')
  );
}

export function getFriendlyNetworkErrorMessage(
  error: unknown,
  fallback = 'Network connection error. Please check your internet connection and try again.'
): string {
  if (isNetworkError(error)) {
    return 'Connection to server timed out or was interrupted. Please check your network connection and try again.';
  }
  return error instanceof Error ? error.message : fallback;
}
