"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CheckoutQuote, CheckoutQuoteRequest, CheckoutQuoteResponse } from "./checkout-contract";
import { supabase } from "./supabase";
import { quoteMatchesReferences } from "./cart-state";

export type QuoteState = {
  signature: string;
  quote?: CheckoutQuote;
  error?: string;
  issues?: { id: string; code: string; message: string }[];
  receivedAt?: number;
};
export const QUOTE_MAX_AGE_MS = 60_000;
export const QUOTE_DEBOUNCE_MS = 250;
export function currentQuote(state: QuoteState, signature: string, now = Date.now()) {
  return state.signature === signature && state.receivedAt !== undefined &&
    now - state.receivedAt < QUOTE_MAX_AGE_MS ? state.quote : undefined;
}
export function payableQuote(quote: CheckoutQuote | undefined): quote is CheckoutQuote & { totalCents: number } {
  return quote?.available === true && !!quote.fingerprint && !!quote.version && quote.delivery.ok &&
    Number.isSafeInteger(quote.totalCents) && quote.totalCents !== null && quote.totalCents > 0 &&
    Number.isSafeInteger(quote.subtotalCents) && Number.isSafeInteger(quote.deliveryFeeCents) &&
    Number.isSafeInteger(quote.preDiscountTotalCents) && Number.isSafeInteger(quote.discountCents) &&
    quote.subtotalCents >= 0 && quote.deliveryFeeCents !== null && quote.deliveryFeeCents >= 0 &&
    quote.discountCents >= 0 && quote.preDiscountTotalCents === quote.subtotalCents + quote.deliveryFeeCents &&
    quote.totalCents === quote.preDiscountTotalCents - quote.discountCents;
}

export function validQuoteTotals(quote: CheckoutQuote): boolean {
  if (!Number.isSafeInteger(quote.subtotalCents) || quote.subtotalCents < 0 ||
      !Number.isSafeInteger(quote.discountCents) || quote.discountCents < 0) return false;
  return quote.available ? payableQuote(quote) : quote.available === false &&
    quote.deliveryFeeCents === null && quote.preDiscountTotalCents === null && quote.totalCents === null;
}

export function useCheckoutQuote(request: CheckoutQuoteRequest, enabled: boolean, invalidationKey = "") {
  const signature = JSON.stringify({ request, invalidationKey });
  const activeSignature = useRef(signature);
  const generation = useRef(0);
  useLayoutEffect(() => { activeSignature.current = signature; generation.current += 1; }, [signature]);
  const [state, setState] = useState<QuoteState>({ signature: "" });
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    const payload: CheckoutQuoteRequest = JSON.parse(signature).request;
    if (!enabled || !payload.items.length) return;
    const controller = new AbortController();
    let active = true;
    const timer = setTimeout(() => setRefresh(value => value + 1), QUOTE_MAX_AGE_MS);
    const debounce = setTimeout(() => { void (async () => {
      try {
        if (!active) return;
        setState({ signature });
        const { data: { session } } = await supabase.auth.getSession();
        if (!active) return;
        const response = await fetch("/api/checkout/quote", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
        const result: CheckoutQuoteResponse = await response.json();
        if (!active || activeSignature.current !== signature) return;
        if (response.ok && result.ok && validQuoteTotals(result.quote) && quoteMatchesReferences(payload.items, result.quote.items)) {
          setState({ signature, quote: result.quote, receivedAt: Date.now() });
        } else if (!result.ok) {
          setState({ signature, error: result.error, issues: result.issues });
        } else {
          setState({ signature, error: "Neizdevās pārbaudīt grozu." });
        }
      } catch {
        if (active && activeSignature.current === signature) setState({ signature, error: "Neizdevās pārbaudīt grozu. Mēģini vēlreiz." });
      }
    })(); }, QUOTE_DEBOUNCE_MS);
    return () => { active = false; controller.abort(); clearTimeout(timer); clearTimeout(debounce); };
  }, [signature, enabled, refresh]);
  return {
    signature, activeSignature, generation, state,
    quote: enabled ? currentQuote(state, signature) : undefined,
    refresh: () => setRefresh(value => value + 1),
    invalidate: () => { setState({ signature: "" }); setRefresh(value => value + 1); },
    replace: (quote: CheckoutQuote, expectedSignature: string) => {
      if (activeSignature.current !== expectedSignature) return false;
      if (!validQuoteTotals(quote) || !quoteMatchesReferences(JSON.parse(expectedSignature).request.items, quote.items)) return false;
      setState({ signature: expectedSignature, quote, receivedAt: Date.now() });
      return true;
    },
  };
}
