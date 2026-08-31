"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Mail, RefreshCw, Send } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { Tabs } from "@/components/ui/Tabs";
import { listEmailTemplates, previewEmailTemplate, sendTestEmail } from "@/lib/api/admin";
import { ApiError } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import { useAuthStore } from "@/stores/authStore";
import { toast } from "@/stores/uiStore";
import type { EmailTemplate, EmailTemplatePreview } from "@/types/admin";

const CATEGORY_ORDER: EmailTemplate["category"][] = [
  "account",
  "seller",
  "waitlist",
  "gdpr",
  "internal",
];

const CATEGORY_LABELS: Record<EmailTemplate["category"], string> = {
  account: "Account",
  seller: "Seller",
  waitlist: "Waitlist",
  gdpr: "GDPR",
  internal: "Internal",
};

type PreviewTab = "html" | "text";

type SendFailure = {
  message: string;
  /** True for the 503 case — outbound mail is not configured on this environment. */
  mailNotConfigured: boolean;
};

export default function EmailTemplatesPage() {
  // UI courtesy only — POST /admin/email-templates/:key/test enforces emailTemplates.test.
  const canSendTest = useAuthStore((s) => s.can("emailTemplates.test"));
  const [templates, setTemplates] = useState<EmailTemplate[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [preview, setPreview] = useState<EmailTemplatePreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewTab, setPreviewTab] = useState<PreviewTab>("html");

  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<SendFailure | null>(null);

  // Bumped on every preview request so a slow response for a template the
  // operator has already clicked away from can never overwrite the pane.
  const previewSeq = useRef(0);

  const load = useCallback(async () => {
    try {
      const data = await listEmailTemplates();
      setTemplates(data);
      setError(null);
    } catch (err) {
      setTemplates([]);
      setError(err instanceof ApiError ? err.message : "Could not load email templates.");
    }
  }, []);

  const loadPreview = useCallback(async (key: string) => {
    const seq = ++previewSeq.current;
    try {
      const data = await previewEmailTemplate(key);
      if (previewSeq.current !== seq) return;
      setPreview(data);
      setPreviewError(null);
    } catch (err) {
      if (previewSeq.current !== seq) return;
      setPreview(null);
      setPreviewError(
        err instanceof ApiError ? err.message : "Could not render the template preview."
      );
    }
  }, []);

  useEffect(() => {
    // The loader only touches state after its await; awaiting it from an
    // inline async function keeps the effect body itself free of setState.
    const run = async () => {
      await load();
    };
    void run();
  }, [load]);

  // Auto-select the first template once the catalog arrives, or re-select when
  // a refresh dropped the previously selected key. Adjusting during render
  // (the same pattern the users page uses for filter resets) keeps the effect
  // below a pure fetch trigger and shows the preview skeleton on the very next
  // paint.
  if (templates && templates.length > 0 && !templates.some((t) => t.key === selectedKey)) {
    setSelectedKey(templates[0].key);
    setPreview(null);
    setPreviewError(null);
    setSendError(null);
    setPreviewTab("html");
  }

  useEffect(() => {
    if (!selectedKey) return;
    // Same shape as above: the preview loader defers all setState past its await.
    const run = async () => {
      await loadPreview(selectedKey);
    };
    void run();
  }, [selectedKey, loadPreview]);

  function handleSelect(key: string) {
    if (key === selectedKey) return;
    setSelectedKey(key);
    setPreview(null);
    setPreviewError(null);
    setSendError(null);
    setPreviewTab("html");
  }

  function handleRefresh() {
    void load();
    // Re-render the currently open preview too — this screen exists to verify
    // rendering, so a refresh should re-run the template, not just the list.
    if (selectedKey) {
      setPreview(null);
      setPreviewError(null);
      setSendError(null);
      void loadPreview(selectedKey);
    }
  }

  function handleRetryPreview() {
    if (!selectedKey) return;
    setPreview(null);
    setPreviewError(null);
    void loadPreview(selectedKey);
  }

  async function handleSendTest() {
    if (!selectedKey || sending) return;
    setSendError(null);
    setSending(true);
    try {
      await sendTestEmail(selectedKey);
      toast({
        title: "Test email sent",
        description: preview?.subject ?? selectedKey,
        tone: "success",
      });
    } catch (err) {
      if (err instanceof ApiError) {
        setSendError({ message: err.message, mailNotConfigured: err.status === 503 });
      } else {
        setSendError({ message: "Could not send the test email.", mailNotConfigured: false });
      }
    } finally {
      setSending(false);
    }
  }

  const selected = templates?.find((t) => t.key === selectedKey) ?? null;

  const groups = templates
    ? CATEGORY_ORDER.map((category) => ({
        category,
        templates: templates.filter((t) => t.category === category),
      })).filter((group) => group.templates.length > 0)
    : [];

  return (
    <>
      <PageHeader
        title="Email Templates"
        description="Every transactional email the platform sends. Copy lives in code — this screen verifies rendering and delivery."
        actions={
          <Button variant="outline" onClick={handleRefresh}>
            <RefreshCw size={15} aria-hidden /> Refresh
          </Button>
        }
      />

      {error && (
        <Card className="mb-4 border-danger/25 bg-danger/5 p-4 text-sm font-medium text-danger">
          {error}
        </Card>
      )}

      {templates === null ? (
        <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
          <Card className="space-y-3 p-5">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </Card>
          <Card className="space-y-3 p-6">
            <Skeleton className="h-6 w-2/3" />
            <Skeleton className="h-9 w-56" />
            <Skeleton className="h-[480px] w-full" />
          </Card>
        </div>
      ) : templates.length === 0 && !error ? (
        <Card className="p-6">
          <EmptyState
            icon={Mail}
            title="No email templates registered"
            description="Templates are declared in backend code. Once one is registered there, it shows up here for preview and test sends."
          />
        </Card>
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
          <Card className="p-3">
            <nav aria-label="Email templates" className="space-y-4">
              {groups.map((group) => (
                <div key={group.category}>
                  <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
                    {CATEGORY_LABELS[group.category]}
                  </p>
                  <ul className="space-y-1">
                    {group.templates.map((template) => {
                      const isSelected = template.key === selectedKey;
                      return (
                        <li key={template.key}>
                          <button
                            type="button"
                            aria-current={isSelected ? "true" : undefined}
                            onClick={() => handleSelect(template.key)}
                            className={cn(
                              "w-full rounded-xl px-3 py-2.5 text-left transition-colors",
                              isSelected ? "bg-brand-50" : "hover:bg-tile"
                            )}
                          >
                            <span
                              className={cn(
                                "block text-sm font-medium",
                                isSelected ? "text-brand-700" : "text-ink"
                              )}
                            >
                              {template.label}
                            </span>
                            <span
                              className={cn(
                                "mt-0.5 block text-xs",
                                isSelected ? "text-brand-600" : "text-ink-muted"
                              )}
                            >
                              {template.trigger}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </nav>
          </Card>

          <Card className="p-0">
            <CardHeader
              title={selected?.label ?? "Preview"}
              description={selected?.trigger}
              actions={
                canSendTest ? (
                  <Button
                    loading={sending}
                    disabled={!selectedKey}
                    onClick={() => void handleSendTest()}
                  >
                    {!sending && <Send size={15} aria-hidden />} Send test to my inbox
                  </Button>
                ) : undefined
              }
            />
            <CardBody className="space-y-4">
              {sendError && (
                <div
                  role="alert"
                  className="rounded-xl border border-danger/25 bg-danger/10 px-3.5 py-2.5"
                >
                  <p className="text-sm font-medium text-danger">{sendError.message}</p>
                  {sendError.mailNotConfigured && (
                    <p className="mt-1 text-sm text-danger/80">
                      Nothing was queued — this environment has no outbound mail provider set
                      up, so test sends stay unavailable until one is configured.
                    </p>
                  )}
                </div>
              )}

              {previewError ? (
                <div
                  role="alert"
                  className="flex items-center justify-between gap-3 rounded-xl border border-danger/25 bg-danger/10 px-3.5 py-2.5"
                >
                  <p className="text-sm font-medium text-danger">{previewError}</p>
                  <Button variant="outline" size="sm" onClick={handleRetryPreview}>
                    Retry
                  </Button>
                </div>
              ) : preview === null ? (
                <div className="space-y-3">
                  <Skeleton className="h-5 w-2/3" />
                  <Skeleton className="h-9 w-56" />
                  <Skeleton className="h-[560px] w-full rounded-xl" />
                </div>
              ) : (
                <>
                  <p className="text-base font-bold text-ink">{preview.subject}</p>
                  <Tabs
                    tabs={[
                      { key: "html", label: "HTML preview" },
                      { key: "text", label: "Plain text" },
                    ]}
                    active={previewTab}
                    onChange={(key) => setPreviewTab(key as PreviewTab)}
                  />
                  {previewTab === "html" ? (
                    // Email HTML brings its own background, so the iframe
                    // surface stays white in both console themes.
                    <iframe
                      srcDoc={preview.html}
                      sandbox=""
                      title={`${preview.label} — rendered email`}
                      className="h-[560px] w-full rounded-xl border border-hairline bg-white"
                    />
                  ) : (
                    <pre className="h-[560px] w-full overflow-auto rounded-xl border border-hairline bg-tile p-4 font-mono text-xs text-ink">
                      {preview.text}
                    </pre>
                  )}
                </>
              )}
            </CardBody>
          </Card>
        </div>
      )}
    </>
  );
}
