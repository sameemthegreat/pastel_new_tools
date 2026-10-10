/**
 * Public catalog shapes (marketplace_new_backend `ListingResource`), trimmed to the fields the
 * console reads. Not operator data — see `src/lib/api/catalog.ts`.
 */

/** One listing photo; position 0 is the cover. `url` is null while an upload is still processing. */
export type ListingImage = { assetId: string; url: string | null; position: number };

export type PublicListing = {
  id: string;
  title: string;
  /** `draft`, `pendingApproval`, `published`, or `closed`. */
  state: string;
  authorId: string;
  images: ListingImage[];
};
