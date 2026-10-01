/**
 * !! VIETTUR IS, NEVIS ĪSTI TIPI !!
 *
 * `Tables`, `Views` un `Functions` šeit ir `Record<string, unknown>`. Tas nozīmē,
 * ka jebkurs vaicājums caur šo tipu atgriež `unknown` — tipu drošības NAV,
 * lai gan pēc izskata šķiet, ka ir. Neuzticies tam.
 *
 * Lai ģenerētu īstos tipus no dzīvās shēmas:
 *   npm run db:types
 * (prasa Supabase CLI un piekļuves tokenu)
 *
 * Līdz tam apps/tirgus lieto savu `lib/db-types.ts` ar rokām rakstītiem tipiem.
 * Nepārej uz šo pakotni, kamēr tipi nav ģenerēti.
 */
export type Database = {
  public: {
    Tables: Record<string, unknown>;
    Views: Record<string, unknown>;
    Functions: Record<string, unknown>;
    Enums: {
      user_role: "customer" | "buyer" | "seller" | "business" | "courier" | "franchise" | "admin";
      shipment_size: "M" | "L" | "XL";
      temp_mode: "istabas" | "atdzesets" | "saldets" | "karsts";
      shipment_status: "izveidots" | "apmaksats" | "pienemts" | "cela" | "pakomata" | "izsniegts" | "atcelts";
      delivery_status: "pieejams" | "rezervets" | "savakts" | "piegadats" | "atcelts";
      payment_status: "gaida" | "apmaksats" | "atmaksats" | "neizdevas";
      compartment_status: "brivs" | "rezervets" | "aiznemts" | "serviss";
    };
  };
};
