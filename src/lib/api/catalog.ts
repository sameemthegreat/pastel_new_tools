import { apiFetch } from "@/lib/api/client";
import type { PublicListing } from "@/types/catalog";

/**
 * Public listing reads. These are not operator routes, so they go straight to the backend rather
 * than through the `/api/admin` proxy, and need no token.
 */

/**
 * Up to 100 listings in one call (`GET /listings/batch`), in the order asked. Removed (soft-deleted)
 * and unknown ids are silently left out, so a missing id means "no longer on the marketplace".
 */
export function getListingsBatch(ids: string[]): Promise<PublicListing[]> {
  if (ids.length === 0) return Promise.resolve([]);
  const unique = [...new Set(ids)].slice(0, 100);
  return apiFetch<PublicListing[]>(`/listings/batch?ids=${unique.map(encodeURIComponent).join(",")}`);
}
