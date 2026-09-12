"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Paintbrush, RefreshCw, RotateCcw } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { getThemeConfig, updateTheme } from "@/lib/api/meta";
import { ApiError } from "@/lib/api/client";
import { formatDate } from "@/lib/format";
import { toast } from "@/stores/uiStore";
import {
  BUILTIN_THEME_TOKENS,
  THEME_TOKEN_FIELDS,
  THEME_TOKEN_KEYS,
  type ThemeConfig,
  type ThemeTokens,
  type UpdateThemePayload,
} from "@/types/theme";

const HEX_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/** A full editable palette built from a base, overlaid with any (partial) override map. */
function mergeTokens(base: ThemeTokens, overrides: Record<string, string> | null): ThemeTokens {
  const out = { ...base };
  if (overrides) {
    for (const key of THEME_TOKEN_KEYS) {
      const val = overrides[key];
      if (typeof val === "string" && val.trim()) out[key] = val.trim();
    }
  }
  return out;
}

/** `<input type="color">` needs a 7-char hex; fall back to black for anything it can't render. */
function normalizeHex(value: string): string {
  const v = value.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(v)) return v;
  if (/^#[0-9a-fA-F]{3}$/.test(v)) {
    return "#" + v.slice(1).split("").map((c) => c + c).join("");
  }
  return "#000000";
}

export default function ThemePage() {
  const [config, setConfig] = useState<ThemeConfig | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Built-in switcher.
  const [selectedBuiltin, setSelectedBuiltin] = useState("");
  const [savingBuiltin, setSavingBuiltin] = useState(false);

  // Custom-palette editor.
  const [customName, setCustomName] = useState("");
  const [tokens, setTokens] = useState<ThemeTokens>(BUILTIN_THEME_TOKENS.default);
  const [savingCustom, setSavingCustom] = useState(false);

  const applyConfig = useCallback((data: ThemeConfig) => {
    setConfig(data);
    setSelectedBuiltin(
      data.availableThemes.includes(data.activeTheme)
        ? data.activeTheme
        : (data.availableThemes[0] ?? "default")
    );
    // Seed the editor from whatever is currently live so "try new options" starts from reality.
    setTokens(mergeTokens(BUILTIN_THEME_TOKENS.default, data.tokens));
    setCustomName(data.tokens ? data.activeTheme : "");
  }, []);

  const load = useCallback(async () => {
    try {
      const data = await getThemeConfig();
      applyConfig(data);
      setError(null);
    } catch (err) {
      setConfig(null);
      setError(err instanceof ApiError ? err.message : "Could not load the app theme.");
    }
  }, [applyConfig]);

  useEffect(() => {
    // Keep setState out of the effect body itself — it only fires after load()'s await.
    const run = async () => {
      await load();
    };
    void run();
  }, [load]);

  const hasCustomLive = Boolean(config?.tokens);

  // ── Exact request bodies — the object that gets PATCHed to /api/v1/meta/theme ──
  const builtinPayload: UpdateThemePayload = useMemo(
    () => ({ activeTheme: selectedBuiltin }),
    [selectedBuiltin]
  );
  const customPayload: UpdateThemePayload = useMemo(
    () => ({ activeTheme: customName.trim(), tokens }),
    [customName, tokens]
  );

  const invalidTokens = THEME_TOKEN_KEYS.filter((k) => !HEX_RE.test(tokens[k]));
  const customValid = customName.trim().length > 0 && invalidTokens.length === 0;

  async function applyBuiltin() {
    if (savingBuiltin || !selectedBuiltin) return;
    setSavingBuiltin(true);
    try {
      const data = await updateTheme(builtinPayload);
      applyConfig(data);
      toast({
        title: "Theme updated",
        description: `App now serving "${data.activeTheme}". Applies on next app launch/refresh.`,
        tone: "success",
      });
    } catch (err) {
      toast({
        title: "Could not update theme",
        description: err instanceof ApiError ? err.message : "Unexpected error.",
        tone: "error",
      });
    } finally {
      setSavingBuiltin(false);
    }
  }

  async function applyCustom() {
    if (savingCustom || !customValid) return;
    setSavingCustom(true);
    try {
      const data = await updateTheme(customPayload);
      applyConfig(data);
      toast({
        title: "Custom palette pushed",
        description: `"${data.activeTheme}" is live — no app release needed.`,
        tone: "success",
      });
    } catch (err) {
      toast({
        title: "Could not push palette",
        description: err instanceof ApiError ? err.message : "Unexpected error.",
        tone: "error",
      });
    } finally {
      setSavingCustom(false);
    }
  }

  function seedFrom(name: string) {
    const base = BUILTIN_THEME_TOKENS[name];
    if (base) setTokens({ ...base });
  }

  function setToken(key: (typeof THEME_TOKEN_KEYS)[number], value: string) {
    setTokens((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <>
      <PageHeader
        title="App Theme"
        description="Control the theme the Pastel mobile app applies at launch — live, with no app release or OTA."
        actions={
          <Button variant="outline" icon={RefreshCw} loading={config === null && !error} onClick={() => void load()}>
            Refresh
          </Button>
        }
      />

      {error && (
        <Card className="mb-4 border-error-500/25 bg-error-50 p-4 text-sm font-medium text-error-700">
          {error}
        </Card>
      )}

      {config === null && !error ? (
        <Card className="space-y-3 p-6">
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </Card>
      ) : config ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* ── Current state ── */}
          <Card className="lg:col-span-2">
            <CardHeader
              title="Currently live"
              description="What the app fetches from GET /api/v1/meta/theme right now."
            />
            <CardBody className="flex flex-wrap items-center gap-x-8 gap-y-4">
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-ink-muted">Active theme</div>
                <div className="mt-1 flex items-center gap-2">
                  <span className="text-lg font-semibold text-ink">{config.activeTheme}</span>
                  {hasCustomLive ? (
                    <Badge tone="gold" dot>Custom tokens</Badge>
                  ) : (
                    <Badge tone="success" dot>Built-in</Badge>
                  )}
                </div>
              </div>
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-ink-muted">Ships in app</div>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {config.availableThemes.map((name) => (
                    <Badge key={name} tone="neutral">{name}</Badge>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-ink-muted">Last changed</div>
                <div className="mt-1 text-sm text-ink">{formatDate(config.updatedAt)}</div>
              </div>
              <p className="w-full text-xs text-ink-muted">
                Note: the backend holds this in-memory (not in the database) — it resets to the{" "}
                <code className="rounded bg-tile px-1 py-0.5">ACTIVE_THEME</code> env default when the API restarts.
              </p>
            </CardBody>
          </Card>

          {/* ── Built-in switcher ── */}
          <Card>
            <CardHeader
              title="Switch built-in theme"
              description="Flip between the palettes the app ships. Clears any custom tokens."
            />
            <CardBody className="space-y-4">
              <Select
                label="Theme"
                value={selectedBuiltin}
                onChange={setSelectedBuiltin}
                options={config.availableThemes.map((name) => ({ value: name, label: name }))}
              />
              <PayloadPreview payload={builtinPayload} />
              <Button
                icon={Check}
                loading={savingBuiltin}
                disabled={!selectedBuiltin || (selectedBuiltin === config.activeTheme && !hasCustomLive)}
                onClick={() => void applyBuiltin()}
              >
                Apply “{selectedBuiltin}”
              </Button>
            </CardBody>
          </Card>

          {/* ── Live preview ── */}
          <Card>
            <CardHeader title="Preview" description="The palette you're composing below." />
            <CardBody>
              <ThemePreview name={customName || "custom"} tokens={tokens} />
            </CardBody>
          </Card>

          {/* ── Custom palette editor ── */}
          <Card className="lg:col-span-2">
            <CardHeader
              title="Try a new palette"
              description="Push a brand-new theme layered over the app's tokens — renders live with zero app release."
              actions={
                <>
                  <Button variant="ghost" size="sm" icon={RotateCcw} onClick={() => seedFrom("default")}>
                    Reset to default
                  </Button>
                  {config.availableThemes.includes("christmas") && (
                    <Button variant="ghost" size="sm" onClick={() => seedFrom("christmas")}>
                      Seed from christmas
                    </Button>
                  )}
                </>
              }
            />
            <CardBody className="space-y-5">
              <Input
                label="Theme name (activeTheme)"
                required
                placeholder="e.g. midnight, valentines, summer"
                hint="Any string. The app renders these tokens under this name."
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
              />

              <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
                {THEME_TOKEN_FIELDS.map(({ key, label, hint }) => {
                  const value = tokens[key];
                  const bad = !HEX_RE.test(value);
                  return (
                    <div key={key} className="flex items-center gap-3">
                      <input
                        type="color"
                        aria-label={`${label} color picker`}
                        value={normalizeHex(value)}
                        onChange={(e) => setToken(key, e.target.value)}
                        className="h-9 w-9 shrink-0 cursor-pointer rounded-lg border border-hairline bg-surface p-0.5"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-sm font-medium text-ink" title={hint}>{label}</span>
                          <code className="text-[11px] text-ink-muted">{key}</code>
                        </div>
                        <input
                          value={value}
                          onChange={(e) => setToken(key, e.target.value)}
                          spellCheck={false}
                          className={
                            "mt-1 h-8 w-full rounded-lg border bg-surface px-2.5 font-mono text-xs text-ink shadow-xs " +
                            (bad ? "border-error-500" : "border-hairline hover:border-tileborder")
                          }
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              <PayloadPreview payload={customPayload} />

              {invalidTokens.length > 0 && (
                <p className="text-xs font-medium text-error-600">
                  Fix {invalidTokens.length} invalid hex value{invalidTokens.length > 1 ? "s" : ""} (use #RGB or #RRGGBB).
                </p>
              )}

              <Button
                icon={Paintbrush}
                loading={savingCustom}
                disabled={!customValid}
                onClick={() => void applyCustom()}
              >
                Push custom palette to the app
              </Button>
            </CardBody>
          </Card>
        </div>
      ) : null}
    </>
  );
}

/** Shows the exact JSON body that will be PATCHed — so you can confirm "the same object" is sent. */
function PayloadPreview({ payload }: { payload: UpdateThemePayload }) {
  return (
    <div>
      <div className="mb-1.5 text-xs font-medium uppercase tracking-wide text-ink-muted">
        PATCH /api/v1/meta/theme
      </div>
      <pre className="scrollbar-thin overflow-x-auto rounded-lg border border-hairline bg-tile px-3 py-2.5 font-mono text-xs text-ink">
        {JSON.stringify(payload, null, 2)}
      </pre>
    </div>
  );
}

/** A tiny mock of the app surfaces so pushed colors are visible before you apply them. */
function ThemePreview({ name, tokens }: { name: string; tokens: ThemeTokens }) {
  return (
    <div
      className="rounded-2xl border p-4"
      style={{ borderColor: tokens.outlineVariant, background: "#ffffff" }}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold" style={{ color: tokens.onSurface }}>{name}</span>
        <span
          className="rounded-full px-2 py-0.5 text-[11px] font-semibold text-white"
          style={{ background: tokens.badge }}
        >
          3
        </span>
      </div>
      <p className="mt-1 text-xs" style={{ color: tokens.onSurfaceVariant }}>
        Handmade ceramic mug
      </p>
      <div className="mt-3 flex items-center gap-2">
        <button
          className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white"
          style={{ background: tokens.primary }}
        >
          Add to cart
        </button>
        <button
          className="rounded-lg px-3 py-1.5 text-xs font-semibold"
          style={{ background: tokens.primaryTile, color: tokens.primary }}
        >
          Favorite
        </button>
        <span className="text-xs font-semibold" style={{ color: tokens.secondary }}>$24.00</span>
      </div>
      <div className="mt-3 flex gap-1.5">
        {THEME_TOKEN_KEYS.map((k) => (
          <span
            key={k}
            title={`${k} ${tokens[k]}`}
            className="h-5 w-5 rounded-md border"
            style={{ background: normalizeHex(tokens[k]), borderColor: tokens.outlineVariant }}
          />
        ))}
      </div>
    </div>
  );
}
