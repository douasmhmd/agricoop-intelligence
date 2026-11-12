/*
 * Runtime configuration. In containers, /config.js (rendered at start-up) sets
 * window.__AGRICOOP_CONFIG__; in development the Vite env / defaults apply.
 */
export interface AppConfig {
  oidcAuthority: string;
  oidcClientId: string;
}

declare global {
  interface Window {
    __AGRICOOP_CONFIG__?: Partial<AppConfig>;
  }
}

const runtime = typeof window !== 'undefined' ? (window.__AGRICOOP_CONFIG__ ?? {}) : {};

export const config: AppConfig = {
  oidcAuthority:
    runtime.oidcAuthority ??
    (import.meta.env.VITE_OIDC_AUTHORITY as string | undefined) ??
    'http://localhost:8080/realms/agricoop',
  oidcClientId:
    runtime.oidcClientId ??
    (import.meta.env.VITE_OIDC_CLIENT_ID as string | undefined) ??
    'agricoop-web',
};
