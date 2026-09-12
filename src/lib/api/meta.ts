import { envelopeFetch } from "@/lib/api/client";
import type { ThemeConfig, UpdateThemePayload } from "@/types/theme";

/**
 * App-theme (meta) endpoints. Both go same-origin through the `/api/meta/theme` proxy, which forwards
 * to `${BACKEND}/meta/theme` and attaches the operator secret server-side. No Bearer token — the
 * backend meta endpoints are public (they carry no secret).
 */

/** `GET /api/v1/meta/theme` — the theme the app is currently applying. */
export async function getThemeConfig(): Promise<ThemeConfig> {
  const { value } = await envelopeFetch<ThemeConfig>("/api/meta/theme");
  return value;
}

/**
 * `PATCH /api/v1/meta/theme` — flip the active theme. `payload` is sent verbatim as the request body:
 *   - `{ activeTheme }`          → switch to a built-in theme (clears any custom tokens)
 *   - `{ activeTheme, tokens }`  → push a custom palette layered on the built-in theme
 * Takes effect on the app's next fetch (relaunch or refresh).
 */
export async function updateTheme(payload: UpdateThemePayload): Promise<ThemeConfig> {
  const { value } = await envelopeFetch<ThemeConfig>("/api/meta/theme", {
    method: "PATCH",
    body: payload,
  });
  return value;
}
