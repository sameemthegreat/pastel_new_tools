"use client";

import { useState } from "react";
import { ExternalLink, ImageOff } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import type { NormalizedDraft } from "@/types/admin";

/**
 * One fetched listing, editable in place before import. The draft object keeps
 * money as integer cents; the operator edits dollars, so the raw input text
 * lives here as local state (partial entries like "12." would otherwise fight
 * the parser on every keystroke) and only valid values flow up via `onChange`.
 */
export function DraftCard({
  draft,
  onChange,
  onRemove,
}: {
  draft: NormalizedDraft;
  onChange: (draft: NormalizedDraft) => void;
  onRemove: () => void;
}) {
  const [priceText, setPriceText] = useState(() => (draft.priceAmount / 100).toFixed(2));
  const [quantityText, setQuantityText] = useState(() => String(draft.quantity));

  const priceValue = Number(priceText);
  const priceInvalid =
    priceText.trim() === "" || !Number.isFinite(priceValue) || priceValue < 0;
  const quantityValue = Number(quantityText);
  const quantityInvalid =
    quantityText.trim() === "" || !Number.isInteger(quantityValue) || quantityValue < 1;

  function handlePriceChange(raw: string) {
    setPriceText(raw);
    const dollars = Number(raw);
    if (raw.trim() !== "" && Number.isFinite(dollars) && dollars >= 0) {
      onChange({ ...draft, priceAmount: Math.round(dollars * 100) });
    }
  }

  function handleQuantityChange(raw: string) {
    setQuantityText(raw);
    const quantity = Number(raw);
    if (raw.trim() !== "" && Number.isInteger(quantity) && quantity >= 1) {
      onChange({ ...draft, quantity });
    }
  }

  const extraImages = draft.imageUrls.length - 1;

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-start gap-4">
        <div className="flex w-20 shrink-0 flex-col items-center gap-1">
          {draft.imageUrls.length > 0 ? (
            // Plain <img>: these are remote Etsy CDN previews that only exist
            // until the import copies them into Pastel storage.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={draft.imageUrls[0]}
              alt={draft.title}
              className="h-20 max-h-20 w-20 rounded-xl border border-hairline object-cover"
            />
          ) : (
            <span className="flex h-20 w-20 items-center justify-center rounded-xl border border-hairline bg-tile text-ink-muted">
              <ImageOff size={18} aria-hidden="true" />
            </span>
          )}
          {extraImages > 0 && <span className="text-xs text-ink-muted">+{extraImages} more</span>}
        </div>

        <div className="min-w-0 flex-1 space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_8rem_6rem]">
            <Input
              label="Title"
              value={draft.title}
              onChange={(e) => onChange({ ...draft, title: e.target.value })}
            />
            <Input
              label={`Price (${draft.currency})`}
              type="number"
              min={0}
              step="0.01"
              value={priceText}
              error={priceInvalid ? "Enter a price in dollars." : undefined}
              onChange={(e) => handlePriceChange(e.target.value)}
            />
            <Input
              label="Quantity"
              type="number"
              min={1}
              step={1}
              value={quantityText}
              error={quantityInvalid ? "Whole number, at least 1." : undefined}
              onChange={(e) => handleQuantityChange(e.target.value)}
            />
          </div>

          {draft.description && (
            <p className="line-clamp-3 text-sm text-ink-secondary" title={draft.description}>
              {draft.description}
            </p>
          )}

          {draft.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {draft.tags.map((tag) => (
                <Badge key={tag} tone="neutral">
                  {tag}
                </Badge>
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2">
            <a
              href={draft.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline"
            >
              View on Etsy <ExternalLink size={12} aria-hidden="true" />
            </a>
            <Button variant="ghost" size="sm" onClick={onRemove}>
              Remove
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
