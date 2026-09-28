import { ApiError, envelopeFetch, type RequestOptions } from "@/lib/api/client";
import { refreshAccessToken } from "@/lib/api/auth";
import { useAuthStore } from "@/stores/authStore";
import type { GatewayFlipResult, GatewayStatus, GatewayTarget } from "@/types/gateway";

/**
 * API-gateway cutover calls. Same-origin through the `/api/gateway/*` proxy (which attaches the
 * gateway admin token server-side and verifies the operator is a superAdmin). The 401→refresh and
 * 403→revalidate handling mirrors the migration/admin clients, so a mid-session token expiry or a
 * just-revoked operator behaves identically here.
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
  path: string,
  options: Omit<RequestOptions, "accessToken"> = {}
): Promise<T> {
  const token = useAuthStore.getState().accessToken;
  try {
    const { value } = await envelopeFetch<T>(`/api/gateway${path}`, {
      ...options,
      accessToken: token ?? undefined,
    });
    return value;
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      const fresh = await refreshOnce();
      const { value } = await envelopeFetch<T>(`/api/gateway${path}`, { ...options, accessToken: fresh });
      return value;
    }
    if (error instanceof ApiError && error.status === 403) {
      await useAuthStore.getState().revalidate();
    }
    throw error;
  }
}

/** Current routing state of the gateway (which backend all app builds are hitting right now). */
export function getGatewayStatus(): Promise<GatewayStatus> {
  return request<GatewayStatus>("/target");
}

/** Flip every app build to `target` at once. superAdmin only; enforced server-side. */
export function setGatewayTarget(target: GatewayTarget): Promise<GatewayFlipResult> {
  return request<GatewayFlipResult>("/target", { method: "POST", body: { target } });
}
