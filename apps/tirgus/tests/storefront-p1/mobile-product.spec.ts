import "../public-phase3/react-runtime";
import { test, expect } from "@playwright/test";
import React, { isValidElement, type ReactNode, type ReactElement } from "react";
import { PathnameContext } from "next/dist/shared/lib/hooks-client-context.shared-runtime";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { hooks } from "../cart-phase4/hook-harness";
import { CartProvider, type CartItem } from "../../lib/cart-context";
import { AddToCartButton } from "../../components/add-to-cart-button";
import { VariantSelector } from "../../components/variant-selector";
import { ProductPurchaseAction } from "../../components/product-purchase-action";
import { formatPrice } from "../../lib/utils";
import { EmailSubscribeBanner } from "../../components/email-subscribe-banner";

const source = (path: string) => readFileSync(resolve(__dirname, "../..", path), "utf8");
const props = {
  id: "product-a", title: "Konservi", price: 4.9, unit: "gab.",
  image: "/images/product-placeholder.svg", sellerId: "seller-a", sellerName: "Bujums",
  storageType: "chilled" as const, stickyMobile: true,
};
function elements(node: ReactNode): ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!isValidElement<Record<string, unknown>>(node)) return [];
  return [node, ...elements(node.props.children as ReactNode)];
}
function text(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(text).join("");
  return isValidElement<{ children?: ReactNode }>(node) ? text(node.props.children) : "";
}
function button(node: ReactNode, label: string) {
  const found = elements(node).find(e => e.type === "button" && text(e).includes(label));
  expect(found).toBeTruthy();
  return found!;
}
function cartContext(addItem: (item: Omit<CartItem, "quantity">) => void, ready = true, storageError = "") {
  const provider = hooks(() => CartProvider({ children: null }));
  const context = provider.output.type;
  provider.dispose();
  return new Map<unknown, unknown>([[context, { addItem, ready, storageError }]]);
}

test("one sticky base-product button retains canonical identity and hydration guards", () => {
  const added: Omit<CartItem, "quantity">[] = [];
  const runner = hooks(() => AddToCartButton(props), cartContext(item => added.push(item)));
  try {
    expect(elements(runner.output).filter(e => e.type === "button")).toHaveLength(1);
    expect(runner.output.type).toBe(ProductPurchaseAction);
    expect(runner.output.props.stickyMobile).toBe(true);
    expect(text(runner.output)).toContain(`${formatPrice(4.9)} ·`);
    (button(runner.output, "Pievienot grozam").props.onClick as () => void)();
    expect(added).toHaveLength(1);
    expect(added[0]).toMatchObject({ id: "product-a", listingId: "product-a", variantId: null, price: 4.9 });
  } finally { runner.dispose(); }
  for (const [ready, error] of [[false, ""], [true, "Storage blocked"]] as const) {
    const blocked = hooks(() => AddToCartButton(props), cartContext(item => added.push(item), ready, error));
    try {
      expect(button(blocked.output, "Pievienot grozam").props.disabled).toBe(true);
      (button(blocked.output, "Pievienot grozam").props.onClick as () => void)();
      expect(added).toHaveLength(1);
    } finally { blocked.dispose(); }
  }
});

test("sticky price and add action follow the same selected variant", () => {
  const added: Omit<CartItem, "quantity">[] = [];
  const variants = [
    { id: "small", title: "Mazais", price: 4.9, quantity: 10 },
    { id: "large", title: "Lielais", price: 8.5, quantity: 6 },
  ];
  const runner = hooks(() => VariantSelector({ ...props, listingId: props.id, variants }), cartContext(item => added.push(item)));
  try {
    (button(runner.output, "Lielais").props.onClick as () => void)();
    runner.render();
    const actions = elements(runner.output).filter(e => e.type === ProductPurchaseAction);
    expect(actions).toHaveLength(1);
    expect(text(actions[0])).toContain(`${formatPrice(8.5)} ·`);
    (button(actions[0], "Pievienot grozam").props.onClick as () => void)();
    expect(added).toHaveLength(1);
    expect(added[0]).toMatchObject({ listingId: "product-a", variantId: "large", price: 8.5 });
    expect(text(runner.output).indexOf(formatPrice(8.5))).toBeLessThan(text(runner.output).indexOf("Izvēlies apjomu"));
  } finally { runner.dispose(); }
});

test("out-of-stock variant cannot be added through the sticky action", () => {
  const added: unknown[] = [];
  const runner = hooks(() => VariantSelector({
    ...props, listingId: props.id, variants: [{ id: "empty", title: "Nav", price: 4.9, quantity: 0 }],
  }), cartContext(item => added.push(item)));
  try {
    const action = button(runner.output, "Izpārdots");
    expect(action.props.disabled).toBe(true);
    (action.props.onClick as () => void)();
    expect(added).toEqual([]);
  } finally { runner.dispose(); }
});

test("delayed email promotion cannot cover a listing purchase action after navigation", () => {
  const originalStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  const originalTimeout = globalThis.setTimeout;
  let show: (() => void) | undefined;
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { getItem: () => null } });
  globalThis.setTimeout = ((callback: () => void, delay?: number) => {
    if (delay === 30000) { show = callback; return 0; }
    return originalTimeout(callback, delay);
  }) as typeof setTimeout;
  const contexts = new Map<unknown, unknown>([[PathnameContext, "/catalog"]]);
  const runner = hooks(() => {
    const internals = (React as unknown as {
      __CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE: {
        H: { use?: (context: unknown) => unknown; useContext: (context: unknown) => unknown };
      };
    }).__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;
    internals.H.use = internals.H.useContext;
    return EmailSubscribeBanner();
  }, contexts);
  try {
    expect(runner.output).toBeNull();
    show!();
    runner.render();
    expect(text(runner.output)).toContain("Saņem jaunumus e-pastā");
    contexts.set(PathnameContext, "/listing/konservi");
    expect(runner.render()).toBeNull();
    contexts.set(PathnameContext, "/catalog");
    expect(text(runner.render())).toContain("Saņem jaunumus e-pastā");
  } finally {
    runner.dispose();
    globalThis.setTimeout = originalTimeout;
    if (originalStorage) Object.defineProperty(globalThis, "localStorage", originalStorage);
    else Reflect.deleteProperty(globalThis, "localStorage");
  }
});

test("mobile photo is bounded and purchase action clears the safe-area-aware navigation", () => {
  const css = source("app/globals.css");
  expect(css).toContain("height: min(32svh, 18rem)");
  expect(css).toContain("bottom: calc(var(--mobile-nav-height) + env(safe-area-inset-bottom, 0px))");
  expect(css).toContain("@media (min-width: 768px)");
  expect(css).toContain("@apply static border-0");
  expect(source("components/mobile-bottom-nav.tsx")).toContain("mobile-bottom-nav");
  expect(source("components/pwa-install-button.tsx")).toContain('pathname.startsWith("/listing/")');
  const page = source("app/listing/[id]/page.tsx");
  expect(page.indexOf("<VariantSelector")).toBeLessThan(page.indexOf(">Apraksts<"));
  expect(page.indexOf("<AddToCartButton")).toBeLessThan(page.indexOf(">Apraksts<"));
  expect(page.match(/stickyMobile/g)).toHaveLength(2);
  expect(source("app/listing/[id]/product-photo.tsx")).toContain("object-contain md:object-cover");
});
