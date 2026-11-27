/** Same-origin path only ("/x?y"), otherwise "/" (no open redirect through the OIDC state). */
export function safeReturnPath(value: unknown): string {
  return typeof value === 'string' &&
    value.startsWith('/') &&
    !value.startsWith('//') &&
    !value.startsWith('/\\')
    ? value
    : '/';
}
