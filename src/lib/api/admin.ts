import { ApiError, envelopeFetch, type RequestOptions } from "@/lib/api/client";
import { refreshAccessToken } from "@/lib/api/auth";
import { useAuthStore } from "@/stores/authStore";
import type {
  AdminDispute,
  AdminOrder,
  AdminUser,
  AnalyticsDay,
  BundleAdoption,
  CpEmployee,
  CpEmployeeAnalytics,
  CpImport,
  CpOverview,
  CpPost,
  CpUploadPreview,
  CurationScope,
  EmailTemplate,
  EmailTemplatePreview,
  FillSellerImportResult,
  FillSellerStatus,
  NormalizedDraft,
  NativeLogEntry,
  ReferralReport,
  SalesTaxSummary,
  StablePin,
  TaxOrderRow,
  AdminUserDetail,
  DeletionRequest,
  Discount,
  DiscountInput,
  OperatorMember,
  Page,
  PageMeta,
  RefundEligibility,
  SellerApplication,
  SellerApplicationDetail,
  SellerApplicationNote,
  SellerApplicationStats,
} from "@/types/admin";
import type { AdminRole } from "@/types/auth";

/**
 * Operator data endpoints. Everything here goes same-origin through `/api/admin/*` — the proxy
 * route attaches `X-Operator-Secret` server-side — with the session's Bearer token.
 *
 * Two failures are handled centrally rather than by every caller:
 *   401 → the access token expired mid-session. Refresh once through the cookie and retry; a
 *         refresh that fails ends the session.
 *   403 → could be a business rule ("only a super admin can…") or could mean the caller is no
 *         longer an operator at all, because the backend re-checks the AdminMembership on every
 *         admin request and someone revoked it a minute ago. Re-ask `GET /admin/auth/me`: if that
 *         also refuses, the console is holding a dead session and must return to /login rather
 *         than paint a permission error onto every page.
 *
 * Both end-of-session paths go through the layout, which redirects off `status`.
 */

let refreshInFlight: Promise<string> | null = null;

/** One shared refresh so ten parallel 401s rotate the cookie once, not ten times. */
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
): Promise<{ value: T; meta: Record<string, unknown> }> {
  const token = useAuthStore.getState().accessToken;
  try {
    return await envelopeFetch<T>(`/api/admin${path}`, {
      ...options,
      accessToken: token ?? undefined,
    });
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      const fresh = await refreshOnce();
      return envelopeFetch<T>(`/api/admin${path}`, { ...options, accessToken: fresh });
    }
    if (error instanceof ApiError && error.status === 403) {
      // Revoked → session ends and the layout redirects; otherwise it was a genuine business rule.
      await useAuthStore.getState().revalidate();
    }
    throw error;
  }
}

async function adminFetch<T>(
  path: string,
  options: Omit<RequestOptions, "accessToken"> = {}
): Promise<T> {
  const { value } = await request<T>(path, options);
  return value;
}

async function adminFetchPage<T>(path: string, params: Record<string, string | undefined>) {
  const query = new URLSearchParams();
  for (const [key, val] of Object.entries(params)) {
    if (val !== undefined && val !== "") query.set(key, val);
  }
  const qs = query.toString();
  const { value, meta } = await request<T[]>(`${path}${qs ? `?${qs}` : ""}`);
  return { items: value, meta: meta as unknown as PageMeta } satisfies Page<T>;
}

// ── Users ─────────────────────────────────────────────────────────────────

export function listUsers(params: {
  status?: string;
  type?: string;
  search?: string;
  cursor?: string;
  perPage?: string;
}): Promise<Page<AdminUser>> {
  return adminFetchPage<AdminUser>("/users", params);
}

export function getUser(id: string): Promise<AdminUserDetail> {
  return adminFetch<AdminUserDetail>(`/users/${id}`);
}

export function restrictUser(id: string, reason: string): Promise<AdminUser> {
  return adminFetch<AdminUser>(`/users/${id}/restrict`, { method: "POST", body: { reason } });
}

export function unrestrictUser(id: string, reason?: string): Promise<AdminUser> {
  return adminFetch<AdminUser>(`/users/${id}/unrestrict`, {
    method: "POST",
    body: reason ? { reason } : {},
  });
}

export function banUser(id: string, reason: string): Promise<AdminUser> {
  return adminFetch<AdminUser>(`/users/${id}/ban`, { method: "POST", body: { reason } });
}

// ── Seller applications (Requests) ────────────────────────────────────────

export function listApplications(params: {
  status?: string;
  crmStatus?: string;
  cursor?: string;
  perPage?: string;
}): Promise<Page<SellerApplication>> {
  return adminFetchPage<SellerApplication>("/seller-applications", params);
}

export function getApplicationStats(): Promise<SellerApplicationStats> {
  return adminFetch<SellerApplicationStats>("/seller-applications/stats");
}

export function getApplication(id: string): Promise<SellerApplicationDetail> {
  return adminFetch<SellerApplicationDetail>(`/seller-applications/${id}`);
}

export function approveApplication(id: string, note?: string): Promise<SellerApplication> {
  return adminFetch<SellerApplication>(`/seller-applications/${id}/approve`, {
    method: "POST",
    body: note ? { note } : {},
  });
}

export function rejectApplication(
  id: string,
  input: { note?: string; reason?: string; sendEmail?: boolean }
): Promise<SellerApplication> {
  return adminFetch<SellerApplication>(`/seller-applications/${id}/reject`, {
    method: "POST",
    body: input,
  });
}

export function updateApplicationCrm(
  id: string,
  input: { crmStatus?: string | null; assignedAdminId?: string | null; followUpAt?: string | null }
): Promise<SellerApplication> {
  return adminFetch<SellerApplication>(`/seller-applications/${id}/crm`, {
    method: "PATCH",
    body: input,
  });
}

export function addApplicationNote(id: string, body: string): Promise<SellerApplicationNote> {
  return adminFetch<SellerApplicationNote>(`/seller-applications/${id}/notes`, {
    method: "POST",
    body: { body },
  });
}

export function removeApplication(id: string, sendEmail?: boolean): Promise<null> {
  return adminFetch<null>(`/seller-applications/${id}`, {
    method: "DELETE",
    body: sendEmail === undefined ? {} : { sendEmail },
  });
}

export function resendApplicationVerification(id: string): Promise<null> {
  return adminFetch<null>(`/seller-applications/${id}/resend-verification`, {
    method: "POST",
    body: {},
  });
}

// ── Deletion requests ─────────────────────────────────────────────────────

export function listDeletionRequests(params: {
  status?: string;
  cursor?: string;
  perPage?: string;
}): Promise<Page<DeletionRequest>> {
  return adminFetchPage<DeletionRequest>("/deletion-requests", params);
}

export function completeDeletionRequest(id: string, resolution?: string): Promise<DeletionRequest> {
  return adminFetch<DeletionRequest>(`/deletion-requests/${id}/complete`, {
    method: "POST",
    body: resolution ? { resolution } : {},
  });
}

// ── Discounts ─────────────────────────────────────────────────────────────

export function listDiscounts(): Promise<Discount[]> {
  return adminFetch<Discount[]>("/discounts");
}

export function createDiscount(input: DiscountInput): Promise<Discount> {
  return adminFetch<Discount>("/discounts", { method: "POST", body: input });
}

export function updateDiscount(id: string, input: Partial<DiscountInput>): Promise<Discount> {
  return adminFetch<Discount>(`/discounts/${id}`, { method: "PATCH", body: input });
}

export function deactivateDiscount(id: string): Promise<null> {
  return adminFetch<null>(`/discounts/${id}`, { method: "DELETE" });
}

// ── Team ──────────────────────────────────────────────────────────────────

export function listTeam(): Promise<OperatorMember[]> {
  return adminFetch<OperatorMember[]>("/team");
}

export function grantOperator(email: string, role: AdminRole): Promise<OperatorMember> {
  return adminFetch<OperatorMember>("/team", { method: "POST", body: { email, role } });
}

export function updateOperatorRole(userId: string, role: AdminRole): Promise<OperatorMember> {
  return adminFetch<OperatorMember>(`/team/${userId}`, { method: "PATCH", body: { role } });
}

export function revokeOperator(userId: string): Promise<null> {
  return adminFetch<null>(`/team/${userId}`, { method: "DELETE" });
}

// ── Orders & disputes ─────────────────────────────────────────────────────

export function listOrders(params: {
  status?: string;
  search?: string;
  cursor?: string;
  perPage?: string;
}): Promise<Page<AdminOrder>> {
  return adminFetchPage<AdminOrder>("/orders", params);
}

export function listDisputes(params: {
  status?: string;
  cursor?: string;
  perPage?: string;
}): Promise<Page<AdminDispute>> {
  return adminFetchPage<AdminDispute>("/disputes", params);
}

export function getRefundEligibility(orderId: string): Promise<RefundEligibility> {
  return adminFetch<RefundEligibility>(`/orders/${orderId}/refund-eligibility`);
}

export function refundOrder(
  orderId: string,
  input: { mode: "full" | "partial"; amount?: number; reason?: string },
  idempotencyKey: string
): Promise<unknown> {
  return adminFetch<unknown>(`/orders/${orderId}/refund`, {
    method: "POST",
    body: input,
    headers: { "Idempotency-Key": idempotencyKey },
  });
}

export function releaseOrder(orderId: string, reason?: string): Promise<unknown> {
  return adminFetch<unknown>(`/orders/${orderId}/release`, {
    method: "POST",
    body: reason ? { reason } : {},
  });
}

export function approveReplacement(orderId: string, reason?: string): Promise<unknown> {
  return adminFetch<unknown>(`/orders/${orderId}/replacement`, {
    method: "POST",
    body: reason ? { reason } : {},
  });
}

// ── Analytics ─────────────────────────────────────────────────────────────

export function fetchDailyAnalytics(params: { from?: string; to?: string } = {}): Promise<AnalyticsDay[]> {
  const query = new URLSearchParams();
  if (params.from) query.set("from", params.from);
  if (params.to) query.set("to", params.to);
  const qs = query.toString();
  return adminFetch<AnalyticsDay[]>(`/analytics/daily${qs ? `?${qs}` : ""}`);
}

export function fetchReferralReport(): Promise<ReferralReport> {
  return adminFetch<ReferralReport>("/referrals");
}

// ── Sales tax ─────────────────────────────────────────────────────────────

export function fetchSalesTaxSummary(): Promise<SalesTaxSummary> {
  return adminFetch<SalesTaxSummary>("/sales-tax/summary");
}

export function listTaxOrders(params: {
  state?: string;
  cursor?: string;
  perPage?: string;
}): Promise<Page<TaxOrderRow>> {
  return adminFetchPage<TaxOrderRow>("/sales-tax/orders", params);
}

// ── App versions / OTA ────────────────────────────────────────────────────

export function fetchBundleAdoption(): Promise<BundleAdoption> {
  return adminFetch<BundleAdoption>("/app-versions/adoption");
}

export function setStableVersion(version: string | null): Promise<StablePin> {
  return adminFetch<StablePin>("/app-versions/stable", { method: "PUT", body: { version } });
}

export function listNativeLogs(params: {
  level?: string;
  event?: string;
  cursor?: string;
  perPage?: string;
}): Promise<Page<NativeLogEntry>> {
  return adminFetchPage<NativeLogEntry>("/native-logs", params);
}

// ── Email templates ───────────────────────────────────────────────────────

export function listEmailTemplates(): Promise<EmailTemplate[]> {
  return adminFetch<EmailTemplate[]>("/email-templates");
}

export function previewEmailTemplate(key: string): Promise<EmailTemplatePreview> {
  return adminFetch<EmailTemplatePreview>(`/email-templates/${key}/preview`);
}

/** Sends the sample-rendered template to the signed-in operator's own inbox. */
export function sendTestEmail(key: string): Promise<null> {
  return adminFetch<null>(`/email-templates/${key}/test`, { method: "POST", body: {} });
}

// ── Curation ──────────────────────────────────────────────────────────────

export function getCuration(scope: string): Promise<CurationScope> {
  return adminFetch<CurationScope>(`/curation/${encodeURIComponent(scope)}`);
}

/** Replaces the scope wholesale — array order becomes position; empty clears the scope. */
export function replaceCuration(scope: string, listingIds: string[]): Promise<CurationScope> {
  return adminFetch<CurationScope>(`/curation/${encodeURIComponent(scope)}`, {
    method: "PUT",
    body: { listingIds },
  });
}

export function removeCurationPin(scope: string, listingId: string): Promise<null> {
  return adminFetch<null>(`/curation/${encodeURIComponent(scope)}/${listingId}`, {
    method: "DELETE",
  });
}

export function setCollectionEditorPick(id: string, isEditorPick: boolean): Promise<unknown> {
  return adminFetch<unknown>(`/collections/${id}/editor-pick`, {
    method: "POST",
    body: { isEditorPick },
  });
}

// ── Fill Seller ───────────────────────────────────────────────────────────

/** Pasted listing URL → normalized draft. 501 for eBay, 400 unsupported hosts, 503 unconfigured. */
export function previewFillSellerUrl(url: string): Promise<NormalizedDraft> {
  return adminFetch<NormalizedDraft>("/fill-seller/preview", { method: "POST", body: { url } });
}

export function importFillSellerDrafts(input: {
  sellerEmail: string;
  drafts: NormalizedDraft[];
  publish?: boolean;
}): Promise<FillSellerImportResult> {
  return adminFetch<FillSellerImportResult>("/fill-seller/import", {
    method: "POST",
    body: input,
  });
}

export function getFillSellerStatus(): Promise<FillSellerStatus> {
  return adminFetch<FillSellerStatus>("/fill-seller/status");
}

// ── Content Pulse ─────────────────────────────────────────────────────────

/**
 * Multipart upload through the proxy (which forwards bodies verbatim), with the same
 * single-flight 401-refresh-retry as every other admin call.
 */
export async function uploadContentPulseFile(file: File): Promise<CpUploadPreview> {
  const send = async (token: string | null) => {
    const form = new FormData();
    form.append("file", file);
    const response = await fetch("/api/admin/content-pulse/imports/upload", {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      body: form,
    });
    const envelope = (await response.json().catch(() => null)) as {
      status?: boolean;
      message?: string;
      data?: { value: CpUploadPreview };
      errors?: { value?: { field: string; message: string }[] };
    } | null;
    if (!envelope || envelope.status !== true || !response.ok) {
      throw new ApiError(
        response.status,
        envelope?.message ?? "The upload failed. Try again.",
        envelope?.errors?.value ?? []
      );
    }
    return envelope.data!.value;
  };

  try {
    return await send(useAuthStore.getState().accessToken);
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      return send(await refreshOnce());
    }
    if (error instanceof ApiError && error.status === 403) {
      await useAuthStore.getState().revalidate();
    }
    throw error;
  }
}

export function confirmContentPulseImport(input: {
  token: string;
  label?: string;
  period?: string;
}): Promise<CpImport> {
  return adminFetch<CpImport>("/content-pulse/imports/confirm", { method: "POST", body: input });
}

export function listContentPulseImports(): Promise<CpImport[]> {
  return adminFetch<CpImport[]>("/content-pulse/imports");
}

export function deleteContentPulseImport(id: string): Promise<null> {
  return adminFetch<null>(`/content-pulse/imports/${id}`, { method: "DELETE" });
}

export function listContentPulsePosts(params: {
  type?: string;
  search?: string;
  employeeId?: string;
  cursor?: string;
  perPage?: string;
}): Promise<Page<CpPost>> {
  return adminFetchPage<CpPost>("/content-pulse/posts", params);
}

export function setPostAttribution(
  postId: string,
  employeeId: string | null
): Promise<unknown> {
  return adminFetch<unknown>(`/content-pulse/posts/${postId}/attribution`, {
    method: "PUT",
    body: { employeeId },
  });
}

export function listCpEmployees(): Promise<CpEmployee[]> {
  return adminFetch<CpEmployee[]>("/content-pulse/employees");
}

export function createCpEmployee(input: { name: string; handle?: string }): Promise<CpEmployee> {
  return adminFetch<CpEmployee>("/content-pulse/employees", { method: "POST", body: input });
}

export function updateCpEmployee(
  id: string,
  input: { name?: string; handle?: string; active?: boolean }
): Promise<CpEmployee> {
  return adminFetch<CpEmployee>(`/content-pulse/employees/${id}`, {
    method: "PATCH",
    body: input,
  });
}

export function deleteCpEmployee(id: string): Promise<null> {
  return adminFetch<null>(`/content-pulse/employees/${id}`, { method: "DELETE" });
}

export function getCpOverview(days: number): Promise<CpOverview> {
  return adminFetch<CpOverview>(`/content-pulse/analytics/overview?days=${days}`);
}

export function getCpEmployeeAnalytics(): Promise<CpEmployeeAnalytics[]> {
  return adminFetch<CpEmployeeAnalytics[]>("/content-pulse/analytics/employees");
}
