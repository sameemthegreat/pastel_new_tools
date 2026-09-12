"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Pin, RefreshCw, Sparkles, X } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { SearchInput } from "@/components/ui/SearchInput";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  getCuration,
  removeCurationPin,
  replaceCuration,
  setCollectionEditorPick,
} from "@/lib/api/admin";
import { ApiError, apiFetch } from "@/lib/api/client";
import { formatCurrency, formatNumber } from "@/lib/format";
import { useAuthStore } from "@/stores/authStore";
import { toast } from "@/stores/uiStore";
import type { CurationEntry } from "@/types/admin";

/** A scope holds at most 24 pins — the backend rejects longer arrays. */
const MAX_PINS = 24;

// Minimal page-local slices of the PUBLIC catalog resources — just the fields
// this page renders. Shapes verified against the backend's catalog mappers.

/** GET /categories — one node of the active category tree. */
type CategoryNode = { id: string; name: string; level: number };

/** GET /listings?keywords=… — the public browse/search card. */
type ListingHit = {
  id: string;
  title: string;
  priceAmount: number | null;
  priceCurrency: string | null;
};

/** GET /collections?filter=editorsPicks — the public collection browse card. */
type CollectionPick = {
  id: string;
  name: string;
  listingCount: number;
  seller: { shopName: string };
};

function stateLabel(state: string): string {
  const label = state.replace(/_/g, " ").toLowerCase();
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function entryPrice(entry: { priceAmount: number | null }): string {
  return entry.priceAmount === null ? "—" : formatCurrency(entry.priceAmount / 100);
}

export default function CurationPage() {
  // ── Scope + pinned entries ────────────────────────────────────────────
  // UI courtesy only — the curation write routes enforce curation.manage themselves.
  const canManage = useAuthStore((s) => s.can("curation.manage"));
  const [scope, setScope] = useState("home");
  const [serverEntries, setServerEntries] = useState<CurationEntry[] | null>(null);
  const [entries, setEntries] = useState<CurationEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState<CurationEntry | null>(null);

  // ── Scope picker (level-1 categories from the public tree) ────────────
  const [categories, setCategories] = useState<CategoryNode[] | null>(null);
  const [categoriesFailed, setCategoriesFailed] = useState(false);

  // ── Add-listing search ────────────────────────────────────────────────
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [results, setResults] = useState<ListingHit[] | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);

  // ── Editor's picks (collections) ──────────────────────────────────────
  const [picks, setPicks] = useState<CollectionPick[] | null>(null);
  const [picksError, setPicksError] = useState<string | null>(null);
  const [pickInput, setPickInput] = useState("");
  const [pickError, setPickError] = useState<string | null>(null);
  const [pickBusy, setPickBusy] = useState(false);
  const [pickRemovingId, setPickRemovingId] = useState<string | null>(null);

  // Bumped per fresh request so a slow response for an old scope/query is dropped.
  const curationSeq = useRef(0);
  const searchSeq = useRef(0);

  const loadCuration = useCallback(async () => {
    const seq = ++curationSeq.current;
    try {
      const data = await getCuration(scope);
      if (curationSeq.current !== seq) return;
      setServerEntries(data.entries);
      setEntries(data.entries);
      setError(null);
      setSaveError(null);
    } catch (err) {
      if (curationSeq.current !== seq) return;
      setServerEntries([]);
      setEntries([]);
      setError(err instanceof ApiError ? err.message : "Could not load the pinned listings.");
    }
  }, [scope]);

  const loadCategories = useCallback(async () => {
    try {
      const tree = await apiFetch<CategoryNode[]>("/categories");
      setCategories(tree.filter((c) => c.level === 1));
      setCategoriesFailed(false);
    } catch {
      setCategories([]);
      setCategoriesFailed(true);
    }
  }, []);

  const loadPicks = useCallback(async () => {
    try {
      const rows = await apiFetch<CollectionPick[]>("/collections?filter=editorsPicks");
      setPicks(rows);
      setPicksError(null);
    } catch (err) {
      setPicks([]);
      setPicksError(err instanceof ApiError ? err.message : "Could not load Editor's picks.");
    }
  }, []);

  useEffect(() => {
    // The loader only touches state after its await; awaiting it from an
    // inline async function keeps the effect body itself free of setState.
    const run = async () => {
      await loadCuration();
    };
    void run();
  }, [loadCuration]);

  useEffect(() => {
    const run = async () => {
      await Promise.all([loadCategories(), loadPicks()]);
    };
    void run();
  }, [loadCategories, loadPicks]);

  // Debounce the add-listing search so we query once typing pauses (350ms).
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(timer);
  }, [search]);

  const query = debouncedSearch.trim();

  const searchListings = useCallback(async () => {
    if (!query) return;
    const seq = ++searchSeq.current;
    try {
      const hits = await apiFetch<ListingHit[]>(
        `/listings?keywords=${encodeURIComponent(query)}&perPage=10`
      );
      if (searchSeq.current !== seq) return;
      setResults(hits);
      setSearchError(null);
    } catch (err) {
      if (searchSeq.current !== seq) return;
      setResults([]);
      setSearchError(err instanceof ApiError ? err.message : "The listing search failed.");
    }
  }, [query]);

  // A new (debounced) query starts its results over. Clearing during render
  // (adjust-state-during-render, as the Users page does) shows the searching
  // skeleton on the very next paint; the effect below only fetches.
  const [prevQuery, setPrevQuery] = useState(query);
  if (prevQuery !== query) {
    setPrevQuery(query);
    setResults(null);
    setSearchError(null);
  }

  useEffect(() => {
    const run = async () => {
      await searchListings();
    };
    void run();
  }, [searchListings]);

  const scopeOptions = [
    { value: "home", label: "Home pool" },
    ...(categories ?? []).map((c) => ({ value: c.id, label: c.name })),
  ];
  const scopeLabel = scope === "home" ? "Home pool" : (categories?.find((c) => c.id === scope)?.name ?? scope);

  // Dirty when the local id order no longer matches what the server holds.
  const dirty =
    entries !== null &&
    serverEntries !== null &&
    entries.map((e) => e.listingId).join("|") !== serverEntries.map((e) => e.listingId).join("|");

  function handleScopeChange(next: string) {
    setScope(next);
    setServerEntries(null);
    setEntries(null);
    setError(null);
    setSaveError(null);
    setRemoving(null);
  }

  function move(index: number, delta: number) {
    setEntries((prev) => {
      if (!prev) return prev;
      const target = index + delta;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function handleAdd(hit: ListingHit) {
    setEntries((prev) => {
      if (!prev || prev.length >= MAX_PINS || prev.some((e) => e.listingId === hit.id)) return prev;
      // Public search only surfaces published listings, so the new pin is
      // published until the next reload proves otherwise.
      return [
        ...prev,
        {
          listingId: hit.id,
          position: prev.length,
          title: hit.title,
          state: "published",
          priceAmount: hit.priceAmount,
          priceCurrency: hit.priceCurrency,
        },
      ];
    });
  }

  function handleRemoveClick(entry: CurationEntry) {
    if (dirty) {
      // The list already differs from the server, so removal is just another
      // local edit — it goes live with "Save order".
      setEntries((prev) => prev?.filter((e) => e.listingId !== entry.listingId) ?? prev);
      return;
    }
    setRemoving(entry);
  }

  async function handleRemoveConfirmed() {
    if (!removing) return;
    const target = removing;
    setRemoving(null);
    try {
      await removeCurationPin(scope, target.listingId);
      toast({ title: "Pin removed", description: target.title, tone: "success" });
      await loadCuration();
    } catch (err) {
      toast({
        title: "Could not remove the pin",
        description: err instanceof ApiError ? err.message : target.title,
        tone: "error",
      });
    }
  }

  async function handleSaveOrder() {
    if (saving || entries === null) return;
    setSaveError(null);
    setSaving(true);
    try {
      await replaceCuration(
        scope,
        entries.map((e) => e.listingId)
      );
      toast({ title: "Curation saved", description: scopeLabel, tone: "success" });
      await loadCuration();
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : "Could not save the new order.");
    } finally {
      setSaving(false);
    }
  }

  function handleCancelEdits() {
    setEntries(serverEntries);
    setSaveError(null);
  }

  async function handleMakePick() {
    const id = pickInput.trim();
    if (!id || pickBusy) return;
    setPickError(null);
    setPickBusy(true);
    try {
      await setCollectionEditorPick(id, true);
      toast({ title: "Editor's pick added", description: id, tone: "success" });
      setPickInput("");
      await loadPicks();
    } catch (err) {
      setPickError(err instanceof ApiError ? err.message : "Could not update the collection.");
    } finally {
      setPickBusy(false);
    }
  }

  async function handleRemovePick(pick: CollectionPick) {
    if (pickRemovingId) return;
    setPickRemovingId(pick.id);
    try {
      await setCollectionEditorPick(pick.id, false);
      toast({ title: "Editor's pick removed", description: pick.name, tone: "success" });
      await loadPicks();
    } catch (err) {
      toast({
        title: "Could not remove the pick",
        description: err instanceof ApiError ? err.message : pick.name,
        tone: "error",
      });
    } finally {
      setPickRemovingId(null);
    }
  }

  const atCap = (entries?.length ?? 0) >= MAX_PINS;

  return (
    <>
      <PageHeader
        title="Curation"
        description="Hand-picked listings for the home feed and category shelves — pins go live within a minute."
        actions={
          <Button
            variant="outline"
            onClick={() => {
              void loadCuration();
              void loadPicks();
            }}
          >
            <RefreshCw size={15} aria-hidden /> Refresh
          </Button>
        }
      />

      {error && (
        <Card className="mb-4 border-danger/25 bg-danger/5 p-4 text-sm font-medium text-danger">
          {error}
        </Card>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Select
          value={scope}
          onChange={handleScopeChange}
          options={scopeOptions}
          className="w-full sm:w-72"
        />
        {categoriesFailed && (
          <p className="text-xs font-medium text-danger">
            Categories could not be loaded — only the home pool is selectable.
          </p>
        )}
      </div>

      <Card className="p-0">
        <CardHeader
          title="Pinned listings"
          description="Top to bottom is the feed order buyers see. A scope holds up to 24 pins."
          actions={
            entries !== null ? (
              <span className="text-xs font-medium text-ink-muted">
                {entries.length} / {MAX_PINS} pinned
              </span>
            ) : undefined
          }
        />

        {entries === null ? (
          <CardBody className="space-y-3">
            <Skeleton className="h-6 w-1/3" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardBody>
        ) : error && entries.length === 0 ? (
          <CardBody>
            <p className="text-sm text-ink-muted">
              The pins for this scope could not be loaded. Use Refresh to try again.
            </p>
          </CardBody>
        ) : (
          <>
            {entries.length === 0 ? (
              <EmptyState
                icon={Pin}
                title="Nothing is pinned in this scope"
                description="The feed shows the newest listings until you pin — search below to add the first pin."
              />
            ) : (
              <ul className="divide-y divide-hairline">
                {entries.map((entry, index) => (
                  <li key={entry.listingId} className="flex items-center gap-3 px-5 py-3">
                    <span className="w-6 shrink-0 text-right text-sm font-semibold tabular-nums text-ink-muted">
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-ink">{entry.title}</p>
                    </div>
                    {entry.state === "published" ? (
                      <Badge tone="success" dot>
                        Published
                      </Badge>
                    ) : (
                      <Badge tone="warning" dot>
                        {stateLabel(entry.state)}
                      </Badge>
                    )}
                    <span className="w-24 shrink-0 text-right text-sm tabular-nums text-ink-secondary">
                      {entryPrice(entry)}
                    </span>
                    <span className="flex shrink-0 items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`Move ${entry.title} up`}
                        disabled={!canManage || index === 0}
                        onClick={() => move(index, -1)}
                      >
                        <ArrowUp size={14} aria-hidden />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`Move ${entry.title} down`}
                        disabled={!canManage || index === entries.length - 1}
                        onClick={() => move(index, 1)}
                      >
                        <ArrowDown size={14} aria-hidden />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`Remove ${entry.title}`}
                        disabled={!canManage}
                        onClick={() => handleRemoveClick(entry)}
                      >
                        <X size={14} aria-hidden />
                      </Button>
                    </span>
                  </li>
                ))}
              </ul>
            )}

            <div className="border-t border-hairline px-5 py-4">
              <p className="mb-2 text-sm font-medium text-ink">Add listing</p>
              <SearchInput
                value={search}
                onChange={setSearch}
                placeholder="Search published listings…"
                className="sm:w-96"
              />
              {query && (
                <div className="mt-3">
                  {results === null ? (
                    <div className="space-y-2">
                      <Skeleton className="h-9 w-full" />
                      <Skeleton className="h-9 w-full" />
                    </div>
                  ) : searchError ? (
                    <p className="text-sm font-medium text-danger">{searchError}</p>
                  ) : results.length === 0 ? (
                    <p className="text-sm text-ink-muted">
                      No published listings match &ldquo;{query}&rdquo;.
                    </p>
                  ) : (
                    <ul className="divide-y divide-hairline rounded-xl border border-hairline">
                      {results.map((hit) => {
                        const pinned = entries.some((e) => e.listingId === hit.id);
                        return (
                          <li key={hit.id} className="flex items-center gap-3 px-3.5 py-2">
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm text-ink">{hit.title}</p>
                            </div>
                            <span className="shrink-0 text-sm tabular-nums text-ink-secondary">
                              {entryPrice(hit)}
                            </span>
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={!canManage || pinned || atCap}
                              onClick={() => handleAdd(hit)}
                            >
                              {pinned ? "Pinned" : "Add"}
                            </Button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  {atCap && (
                    <p className="mt-2 text-xs text-ink-muted">
                      This scope is at its 24-pin cap — remove a pin to add another.
                    </p>
                  )}
                </div>
              )}
            </div>

            {dirty && (
              <div className="border-t border-hairline bg-tile/50 px-5 py-3">
                {saveError && (
                  <p
                    role="alert"
                    className="mb-3 rounded-xl border border-danger/25 bg-danger/10 px-3.5 py-2.5 text-sm font-medium text-danger"
                  >
                    {saveError}
                  </p>
                )}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm text-ink-secondary">
                    Unsaved changes — the live feed keeps the last saved order until you save.
                  </p>
                  <span className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={handleCancelEdits}>
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      disabled={!canManage}
                      loading={saving}
                      onClick={() => void handleSaveOrder()}
                    >
                      Save order
                    </Button>
                  </span>
                </div>
              </div>
            )}
          </>
        )}
      </Card>

      <Card className="mt-6 p-0">
        <CardHeader
          title="Editor's picks (collections)"
          description="Curated collections badged across the app's browse surfaces."
        />

        {picks === null ? (
          <CardBody className="space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardBody>
        ) : (
          <>
            {picksError && (
              <p className="border-b border-hairline px-5 py-3 text-sm font-medium text-danger">
                {picksError}
              </p>
            )}
            {picks.length === 0 && !picksError ? (
              <EmptyState
                icon={Sparkles}
                title="No Editor’s picks yet"
                description="Paste a collection id below to badge the first one."
              />
            ) : (
              <ul className="divide-y divide-hairline">
                {picks.map((pick) => (
                  <li key={pick.id} className="flex items-center gap-3 px-5 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-ink">{pick.name}</p>
                      <p className="truncate text-xs text-ink-muted">
                        {pick.seller.shopName} · {formatNumber(pick.listingCount)} listings
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={!canManage}
                      loading={pickRemovingId === pick.id}
                      onClick={() => void handleRemovePick(pick)}
                    >
                      Remove pick
                    </Button>
                  </li>
                ))}
              </ul>
            )}

            <div className="border-t border-hairline px-5 py-4">
              {pickError && (
                <p
                  role="alert"
                  className="mb-3 rounded-xl border border-danger/25 bg-danger/10 px-3.5 py-2.5 text-sm font-medium text-danger"
                >
                  {pickError}
                </p>
              )}
              <div className="flex flex-wrap items-end gap-3">
                <Input
                  label="Collection id"
                  placeholder="3fa85f64-5717-4562-b3fc-2c963f66afa6"
                  value={pickInput}
                  onChange={(e) => {
                    setPickInput(e.target.value);
                    setPickError(null);
                  }}
                  className="w-full sm:w-96"
                />
                <Button
                  disabled={!canManage || !pickInput.trim()}
                  loading={pickBusy}
                  onClick={() => void handleMakePick()}
                >
                  Make Editor’s pick
                </Button>
              </div>
            </div>
          </>
        )}
      </Card>

      <ConfirmDialog
        open={removing !== null}
        onClose={() => setRemoving(null)}
        onConfirm={() => void handleRemoveConfirmed()}
        title="Remove pin"
        message={`"${removing?.title ?? ""}" comes off the ${scopeLabel} feed within a minute. The listing itself is not affected.`}
        confirmLabel="Remove"
      />
    </>
  );
}
