/* eslint-disable no-undef */
/**
 * Global type declarations for Fetch API types
 *
 * Node.js 18+ includes native fetch, but TypeScript may not have
 * the DOM types available when targeting Node.js only.
 * These declarations provide the missing types for the OpenAPI-generated client.
 */

// BodyInit type for fetch body parameter
declare global {
  type BodyInit = ReadableStream | XMLHttpRequestBodyInit | null;
  type XMLHttpRequestBodyInit = Blob | BufferSource | FormData | URLSearchParams | string;

  // Request type for fetch
  interface RequestInit {
    body?: BodyInit | null;
    cache?: RequestCache;
    credentials?: RequestCredentials;
    headers?: HeadersInit;
    integrity?: string;
    keepalive?: boolean;
    method?: string;
    mode?: RequestMode;
    redirect?: RequestRedirect;
    referrer?: string;
    referrerPolicy?: ReferrerPolicy;
    signal?: AbortSignal | null;
    window?: null;
  }

  type RequestCache =
    | 'default'
    | 'force-cache'
    | 'no-cache'
    | 'no-store'
    | 'only-if-cached'
    | 'reload';
  type RequestCredentials = 'include' | 'omit' | 'same-origin';
  type RequestMode = 'cors' | 'navigate' | 'no-cors' | 'same-origin';
  type RequestRedirect = 'error' | 'follow' | 'manual';
  type ReferrerPolicy =
    | ''
    | 'no-referrer'
    | 'no-referrer-when-downgrade'
    | 'origin'
    | 'origin-when-cross-origin'
    | 'same-origin'
    | 'strict-origin'
    | 'strict-origin-when-cross-origin'
    | 'unsafe-url';
}

export {};
