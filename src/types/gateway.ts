/**
 * Shapes returned by the Pastel API gateway (the Sharetribe ↔ v2-wrapper cutover switch).
 *
 * These are the gateway's OWN JSON (not the backend envelope) — the `/api/gateway/*` BFF calls the
 * gateway, then wraps the payload below into the standard `data.value` envelope so the console's
 * `envelopeFetch` consumes it like any other endpoint. See `src/app/api/gateway/target/route.ts`.
 */

/** Where the gateway currently sends all SDK traffic. */
export type GatewayTarget = "sharetribe" | "wrapper";

/** `GET /gateway/status` on the gateway — the live routing state. */
export type GatewayStatus = {
  /** The active upstream every app build is being proxied to right now. */
  target: GatewayTarget;
  /** Resolved base URL of the active target (e.g. https://flex-api.sharetribe.com). */
  upstream: string;
  /** ISO timestamp of the last runtime flip, or null if it's still on the env default. */
  switchedAt: string | null;
  /** Gateway process uptime, seconds. */
  uptimeSec: number;
  /** Whether the `X-Gateway-Target` test-override header is accepted (should be OFF in prod). */
  targetHeaderEnabled: boolean;
  /** Whether GATEWAY_ADMIN_TOKEN is set on the gateway — if false, flips are impossible (404). */
  runtimeFlipArmed: boolean;
};

/** `POST /gateway/target` on the gateway — the result of a flip. */
export type GatewayFlipResult = {
  ok: boolean;
  previous: GatewayTarget;
  target: GatewayTarget;
  switchedAt: string;
};

/** Human labels for the two targets, for chrome. */
export const GATEWAY_TARGET_LABELS: Record<GatewayTarget, string> = {
  wrapper: "v2 backend (wrapper)",
  sharetribe: "Sharetribe",
};
