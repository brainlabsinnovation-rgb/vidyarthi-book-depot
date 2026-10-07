"use client";

import { useEffect, useState } from "react";
import { useShop } from "@/components/shop-provider";

export type CartQuote = {
  items: Array<{ slug: string; name: string; quantity: number; unitPricePaise: number; lineTotalPaise: number }>;
  currency: "INR";
  mrpSubtotalPaise: number;
  productSavingsPaise: number;
  subtotalPaise: number;
  offerDiscountPaise: number;
  deliveryPaise: number | null;
  totalPaise: number | null;
  fulfilment: "pickup" | "delivery";
  source: "sample" | "database";
};

export function useCartQuote(fulfilment: "pickup" | "delivery", requireAccount = false) {
  const { cart } = useShop();
  const items = cart.map(({ product, quantity }) => ({ slug: product.slug, quantity }));
  const key = JSON.stringify({ items, fulfilment });
  const itemCount = items.length;
  const [state, setState] = useState<{ key: string; quote?: CartQuote; error?: string }>({ key: "" });

  useEffect(() => {
    if (itemCount === 0) return;
    const controller = new AbortController();
    fetch(requireAccount ? "/api/store/checkout/prepare" : "/api/store/checkout/quote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: key,
      signal: controller.signal,
    }).then(async (response) => {
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(typeof body.error === "string" ? body.error : "Could not verify your cart");
      }
      return response.json() as Promise<CartQuote>;
    }).then((quote) => setState({ key, quote }))
      .catch((reason) => { if (reason?.name !== "AbortError") setState({ key, error: reason.message ?? "Could not verify your cart" }); });
    return () => controller.abort();
  }, [key, itemCount, requireAccount]);

  return { quote: state.key === key ? state.quote : undefined, error: state.key === key ? state.error : undefined, verifying: itemCount > 0 && state.key !== key };
}
