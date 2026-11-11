/*
 * Generated responses are unions over every documented status ({ data, status }). The fetch mutator
 * throws ApiError for non-2xx, so only 2xx members ever reach components: `ok()` narrows to them.
 */
type Envelope = { status: number; data: unknown };
type Success<R> = Extract<R, { status: 200 | 201 | 204 }>;

export function ok<R extends Envelope>(response: R | undefined): Success<R>['data'] | undefined {
  if (!response || response.status < 200 || response.status >= 300) return undefined;
  return response.data;
}
