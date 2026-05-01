/**
 * Quick Access fetch utility.
 * Sends X-Quick-Token header instead of Supabase JWT for authentication.
 */
export async function quickFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const url = input.toString();
    const method = init?.method || 'GET';
    const body = init?.body;

    const token = typeof window !== 'undefined' ? sessionStorage.getItem('quick-token') : null;

    if (!token) {
        console.warn('[quickFetch] No quick-token found in sessionStorage');
    }

    const headers = new Headers(init?.headers);
    if (token) {
        headers.set('X-Quick-Token', token);
    }
    // Default JSON content-type for requests with body
    if (body && !headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
    }

    return fetch(url, {
        ...init,
        method,
        headers,
        body,
    });
}
