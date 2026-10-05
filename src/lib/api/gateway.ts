import { ApiError, envelopeFetch, type RequestOptions } from "@/lib/api/client";
import { refreshAccessToken } from "@/lib/api/auth";
import { useAuthStore } from "@/stores/authStore";
import type {
  GatewayEnv,
  GatewayFlipResult,
  GatewayStatus,
  GatewayTarget,
} from "@/types/gateway";

/**
 * API-gateway cutover calls, per environment. Same-origin through the `/api/gateway/<env>/*`
 * proxy (which attaches that gateway's admin token server-side and verifies the operator is a
 * superAdmin). The 401→refresh and 403→revalidate handling mirrors the migration/admin clients, so
 * a mid-session token expiry or a just-revoked operator behaves identically here.
 */

let refreshInFlight: Promise<string> | null = null;

function refreshOnce(): Promise<string> {
  refreshInFlight ??= (async () => {
    try {
      const { accessToken } = await refreshAccessToken();
      useAuthStore.setState({ accessToken });
      return accessToken;
    } catch (error) {
      useAuthStore.getState().endSession();
      throw error;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

async function request<T>(
  env: GatewayEnv,
  path: string,
  options: Omit<RequestOptions, "accessToken"> = {}
): Promise<T> {
  const url = `/api/gateway/${env}${path}`;
  const token = useAuthStore.getState().accessToken;
  try {
    const { value } = await envelopeFetch<T>(url, { ...options, accessToken: token ?? undefined });
    return value;
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      const fresh = await refreshOnce();
      const { value } = await envelopeFetch<T>(url, { ...options, accessToken: fresh });
      return value;
    }
    if (error instanceof ApiError && error.status === 403) {
      await useAuthStore.getState().revalidate();
    }
    throw error;
  }
}

/** Current routing state of one environment's gateway (which backend its app builds hit right now). */
export function getGatewayStatus(env: GatewayEnv): Promise<GatewayStatus> {
  return request<GatewayStatus>(env, "/target");
}

/** Flip that environment's app builds to `target` at once. superAdmin only; enforced server-side. */
export function setGatewayTarget(env: GatewayEnv, target: GatewayTarget): Promise<GatewayFlipResult> {
  return request<GatewayFlipResult>(env, "/target", { method: "POST", body: { target } });
}
