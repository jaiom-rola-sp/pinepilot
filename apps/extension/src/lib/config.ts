export interface ExtensionConfig {
  apiBaseUrl: string;
  googleClientId: string;
}

/**
 * Read build-time public config. Plasmo inlines `PLASMO_PUBLIC_*` values at
 * build; this function is kept pure (env is injectable) so it is testable.
 */
export function readConfig(
  env: Record<string, string | undefined> = process.env,
): ExtensionConfig {
  return {
    apiBaseUrl: env.PLASMO_PUBLIC_API_BASE_URL ?? "http://localhost:3000",
    googleClientId: env.PLASMO_PUBLIC_GOOGLE_CLIENT_ID ?? "",
  };
}
