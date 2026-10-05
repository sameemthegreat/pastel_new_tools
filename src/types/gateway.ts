/**
 * Shapes returned by the Pastel API gateways (the Sharetribe ↔ v2-wrapper cutover switches).
 *
 * There is one gateway per environment (see `GATEWAY_ENV_META`); each has the same control
 * surface. These are the gateway's OWN JSON (not the backend envelope) — the `/api/gateway/*` BFF
 * calls the gateway, then wraps the payload below into the standard `data.value` envelope so the
 * console's `envelopeFetch` consumes it like any other endpoint.
 * See `src/app/api/gateway/[env]/target/route.ts`.
 */

/** Where a gateway currently sends all SDK traffic. */
export type GatewayTarget = "sharetribe" | "wrapper";

/**
 * Which gateway a call is about. Each environment is a separate gateway process with its own
 * persisted flip state, so production and staging are switched independently.
 */
export type GatewayEnv = "production" | "staging";

export const GATEWAY_ENVS: readonly GatewayEnv[] = ["production", "staging"];

export function isGatewayEnv(value: unknown): value is GatewayEnv {
  return typeof value === "string" && (GATEWAY_ENVS as readonly string[]).includes(value);
}

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

/** Chrome for one environment's switch card. */
export type GatewayEnvMeta = {
  /** Short name shown in the card title. */
  label: string;
  /** Public host of that environment's gateway (display only — the BFF reads the real URL from env). */
  host: string;
  /** Who is repointed when this switch is flipped. Used in copy and confirm dialogs. */
  audience: string;
  /** Human labels for the two targets, as this environment's upstreams are configured. */
  targetLabels: Record<GatewayTarget, string>;
  /** Whether a flip here is production-impacting (drives the danger styling and warnings). */
  isProduction: boolean;
};

export const GATEWAY_ENV_META: Record<GatewayEnv, GatewayEnvMeta> = {
  production: {
    label: "Production",
    host: "api-gateway.mypastel.com",
    audience: "every installed app build",
    targetLabels: {
      sharetribe: "Sharetribe (live)",
      wrapper: "v2 backend (wrapper)",
    },
    isProduction: true,
  },
  staging: {
    label: "Staging",
    host: "staging.api-gateway.mypastel.com",
    audience: "the staging / preview app builds",
    targetLabels: {
      sharetribe: "Sharetribe (dev)",
      wrapper: "v2 staging backend (wrapper)",
    },
    isProduction: false,
  },
};
