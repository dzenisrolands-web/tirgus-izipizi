import { test, expect } from "@playwright/test";
import React, { isValidElement, type ReactElement, type ReactNode } from "react";
import { createRequire } from "node:module";
import { renderToStaticMarkup } from "react-dom/server";
import { PathnameContext } from "next/dist/shared/lib/hooks-client-context.shared-runtime";
import { hooks } from "../cart-phase4/hook-harness";
import { BuyerAddressProvider, useBuyerAddress } from "../../lib/buyer-address-context";
import { BuyerAddressPrompt } from "../../components/buyer-address-prompt";
import { LvAddressAutocomplete, type ParsedAddress } from "../../components/lv-address-autocomplete";

const jsxRuntime = createRequire(__filename)("playwright/jsx-runtime");
const originalJsx = { ...jsxRuntime };
const originalStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
const originalFetch = globalThis.fetch;
const disposers: (() => void)[] = [];
let storage: Map<string, string>;
let storageDenied = false;
let requests: string[];

test.beforeAll(async () => { Object.assign(jsxRuntime, await import("react/jsx-runtime")); });
test.afterAll(() => { Object.assign(jsxRuntime, originalJsx); });
test.beforeEach(() => {
  storage = new Map(); storageDenied = false; requests = [];
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
    getItem: (key: string) => {
      if (storageDenied) throw new Error("storage denied");
      return storage.get(key) ?? null;
    },
    setItem: (key: string, value: string) => {
      if (storageDenied) throw new Error("storage denied");
      storage.set(key, value);
    },
    removeItem: (key: string) => {
      if (storageDenied) throw new Error("storage denied");
      storage.delete(key);
    },
  } });
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    requests.push(url);
    expect(url).toBe("/api/track-address");
    expect(init?.method).toBe("POST");
    return Response.json({ ok: true });
  };
});
test.afterEach(() => {
  for (const dispose of disposers.splice(0)) dispose();
  globalThis.fetch = originalFetch;
  if (originalStorage) Object.defineProperty(globalThis, "localStorage", originalStorage);
  else Reflect.deleteProperty(globalThis, "localStorage");
});

function run<T>(component: () => T, contexts?: Map<unknown, unknown>) {
  const runner = hooks(() => {
    // Next's usePathname reads its context with React 19's use(context).
    const internals = (React as unknown as {
      __CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE: {
        H: { use?: (context: unknown) => unknown; useContext: (context: unknown) => unknown };
      };
    }).__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;
    internals.H.use = internals.H.useContext;
    return component();
  }, contexts);
  disposers.push(runner.dispose);
  return runner;
}
function elements(node: ReactNode): ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!isValidElement<Record<string, unknown>>(node)) return [];
  return [node, ...elements(node.props.children as ReactNode)];
}
function click(node: ReactNode, title?: string) {
  const button = elements(node).find(element => element.type === "button" && (!title || element.props.title === title));
  expect(button).toBeTruthy();
  (button!.props.onClick as () => void)();
}
function autocomplete(node: ReactNode) {
  return elements(node).find(element => element.type === LvAddressAutocomplete);
}
const selected: ParsedAddress = {
  postalCode: "1001", city: "Rīga", fullText: "Example 1, Rīga, LV-1001", street: "Example 1",
};
async function setup(pathname: string | null, dismissed = false) {
  if (dismissed) storage.set("buyer_address_prompt_dismissed_v1", "1");
  const provider = run(() => BuyerAddressProvider({ children: null }));
  await provider.flush();
  const value = () => provider.output.props.value as ReturnType<typeof useBuyerAddress>;
  const contexts = new Map<unknown, unknown>([[provider.output.type, value()], [PathnameContext, pathname]]);
  const prompt = run(() => BuyerAddressPrompt(), contexts);
  const sync = async () => {
    await provider.flush();
    contexts.set(provider.output.type, value());
    prompt.render();
    await prompt.flush();
  };
  return { provider, prompt, contexts, value, sync };
}

test("homepage alone shows the full address prompt", async () => {
  const { prompt } = await setup("/");
  const html = renderToStaticMarkup(prompt.output);
  expect(html).toContain("parādīsim tuvākos pakomātus");
  expect(html).toContain('title="Vēlāk"');
  expect(autocomplete(prompt.output)).toBeTruthy();
  expect(requests).toEqual([]);
});
for (const pathname of ["/produkti", "/listing/example", "/seller/example", "/cart", "/piegade", null]) {
  test(`non-home route ${pathname} starts as a compact single-line address control`, async () => {
    const { prompt } = await setup(pathname);
    const html = renderToStaticMarkup(prompt.output);
    expect(html).toContain("Ievadi adresi");
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain("parādīsim tuvākos pakomātus");
    expect(autocomplete(prompt.output)).toBeUndefined();
    expect(requests).toEqual([]);
  });
}
test("compact entry opens a closable editor, saves the address and keeps edit/remove usable", async () => {
  const { prompt, value, sync } = await setup("/listing/example");
  click(prompt.output); await prompt.flush();
  expect(renderToStaticMarkup(prompt.output)).toContain('aria-expanded="true"');
  expect(renderToStaticMarkup(prompt.output)).not.toContain("parādīsim tuvākos pakomātus");
  const editor = autocomplete(prompt.output)!;
  expect(editor).toBeTruthy();
  (editor.props.onSelect as (parsed: ParsedAddress) => void)(selected);
  await sync();
  expect(value().address).toMatchObject({ postalCode: "1001", city: "Rīga" });
  expect(autocomplete(prompt.output)).toBeUndefined();
  click(prompt.output, "Mainīt adresi"); await prompt.flush();
  expect(autocomplete(prompt.output)).toBeTruthy();
  const close = elements(prompt.output).find(element => element.type === "button" && element.props.children === "Aizvērt")!;
  (close.props.onClick as () => void)(); await prompt.flush();
  expect(autocomplete(prompt.output)).toBeUndefined();
  click(prompt.output, "Noņemt adresi"); await sync();
  expect(value().address).toBeNull();
  expect(renderToStaticMarkup(prompt.output)).toContain('aria-expanded="false"');
  expect(requests).toEqual(["/api/track-address"]);
});
test("dismissed homepage stays compact even while its editor is open", async () => {
  const { prompt, sync, value } = await setup("/");
  click(prompt.output, "Vēlāk"); await sync();
  expect(value().promptDismissed).toBe(true);
  expect(storage.get("buyer_address_prompt_dismissed_v1")).toBe("1");
  click(prompt.output); await prompt.flush();
  expect(autocomplete(prompt.output)).toBeTruthy();
  expect(renderToStaticMarkup(prompt.output)).not.toContain("parādīsim tuvākos pakomātus");
  click(prompt.output); await prompt.flush();
  expect(autocomplete(prompt.output)).toBeUndefined();
});
test("route changes cannot promote a non-home compact editor into the full banner", async () => {
  const { prompt, contexts } = await setup("/");
  contexts.set(PathnameContext, "/produkti"); prompt.render();
  expect(autocomplete(prompt.output)).toBeUndefined();
  click(prompt.output); await prompt.flush();
  contexts.set(PathnameContext, "/cart"); prompt.render();
  expect(autocomplete(prompt.output)).toBeTruthy();
  expect(renderToStaticMarkup(prompt.output)).not.toContain("parādīsim tuvākos pakomātus");
});
test("denied localStorage reads and writes leave address entry/edit/removal usable", async () => {
  storageDenied = true;
  const { prompt, value, sync } = await setup("/produkti");
  click(prompt.output); await prompt.flush();
  (autocomplete(prompt.output)!.props.onSelect as (parsed: ParsedAddress) => void)(selected);
  await sync();
  expect(value().address?.postalCode).toBe("1001");
  click(prompt.output, "Mainīt adresi"); await prompt.flush();
  expect(autocomplete(prompt.output)).toBeTruthy();
  click(prompt.output, "Noņemt adresi"); await sync();
  expect(value().address).toBeNull();
});
test("SSR needs no localStorage and uses the same route-specific presentation", () => {
  Reflect.deleteProperty(globalThis, "localStorage");
  for (const pathname of ["/", "/cart"]) {
    const html = renderToStaticMarkup(React.createElement(PathnameContext.Provider, { value: pathname },
      React.createElement(BuyerAddressProvider, null, React.createElement(BuyerAddressPrompt))));
    expect(html.includes("parādīsim tuvākos pakomātus")).toBe(pathname === "/");
  }
  expect(requests).toEqual([]);
});
