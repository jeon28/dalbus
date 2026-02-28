import { supabase } from './supabase';
import { Session } from '@supabase/supabase-js';

// Global session cache to avoid redundant and concurrent async calls
let sessionCache: Session | null = null;
let sessionPromise: Promise<Session | null> | null = null;

// Initialize session cache
if (typeof window !== 'undefined') {
    sessionPromise = supabase.auth.getSession().then(({ data: { session } }) => {
        sessionCache = session;
        return session;
    });

    supabase.auth.onAuthStateChange((_event, session) => {
        sessionCache = session;
    });
}

/**
 * Enhanced fetch utility using XMLHttpRequest to avoid Next.js 15's fetch interception issues.
 * Automatically attaches the Supabase JWT token to the Authorization header.
 */
export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const url = input.toString();
    const method = init?.method || 'GET';
    const body = init?.body;

    try {
        // Use cached session if available to avoid awaiting
        let session = sessionCache;

        // If not cached and we are in the browser, try to wait for the initial promise
        if (!session && sessionPromise) {
            // Only wait if it's not a public route or if we really need auth
            // For now, let's try to get it once if not available
            const result = await supabase.auth.getSession();
            session = result.data.session;
            sessionCache = session;
        }

        const token = session?.access_token;

        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open(method, url, true);

            // Set headers
            if (init?.headers) {
                const headers = new Headers(init.headers);
                headers.forEach((value, key) => {
                    xhr.setRequestHeader(key, value);
                });
            }

            if (token) {
                xhr.setRequestHeader('Authorization', `Bearer ${token}`);
            }

            // Default JSON content-type for requests with body
            if (body && !init?.headers) {
                xhr.setRequestHeader('Content-Type', 'application/json');
            }

            xhr.onload = () => {
                const responseHeaders = new Headers();
                const allHeaders = xhr.getAllResponseHeaders();
                if (allHeaders) {
                    const headerLines = allHeaders.trim().split(/[\r\n]+/);
                    headerLines.forEach((line) => {
                        const parts = line.split(': ');
                        const header = parts.shift();
                        const value = parts.join(': ');
                        if (header) responseHeaders.set(header, value);
                    });
                }

                resolve(new Response(xhr.response, {
                    status: xhr.status,
                    statusText: xhr.statusText,
                    headers: responseHeaders,
                }));
            };

            xhr.onerror = () => {
                reject(new Error('Network request failed via XMLHttpRequest'));
            };

            xhr.ontimeout = () => {
                reject(new Error('Network request timed out'));
            };

            xhr.send((body as XMLHttpRequestBodyInit) || null);
        });
    } catch (error) {
        console.error('apiFetch (XHR) error:', error);
        // Fallback to regular fetch if anything goes wrong during setup
        return fetch(input, init);
    }
}
