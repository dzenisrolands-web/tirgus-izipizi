export const CHECKOUT_LISTING_ID = "11111111-1111-4111-8111-111111111111";
export const CHECKOUT_SELLER_ID = "22222222-2222-4222-8222-222222222222";

/** Dummy existing-schema reads only; every write remains the caller's explicit fixture. */
export function checkoutReadFixture(url: URL, init?: RequestInit): Response | undefined {
  if ((init?.method ?? "GET") !== "GET") return undefined;
  if (url.pathname === "/rest/v1/listings") {
    return Response.json([{
      id: CHECKOUT_LISTING_ID, slug: "fixture-product", title: "Fixture item",
      price: 9.34, quantity: 20, unit: "gab.", image_url: "/images/product-placeholder.svg",
      seller_id: CHECKOUT_SELLER_ID, status: "active", variants: [],
      category: "Dzērieni", storage_type: "chilled",
      courier_delivery: true, express_delivery: false,
    }], { headers: { "Content-Range": "0-0/1" } });
  }
  if (url.pathname === "/rest/v1/sellers_public") {
    return Response.json([{
      id: CHECKOUT_SELLER_ID, name: "Fixture seller", home_locker_ids: ["brivibas"],
    }]);
  }
}
