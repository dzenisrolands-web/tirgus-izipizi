/**
 * Single source of truth for "is this seller's profile complete" checks.
 *
 * BUG THIS FIXES: app/admin/razotaji's onboarding checklist only tracked 4
 * fields (profils, juridiskā info, IBAN, self-billing), while
 * app/api/notify/seller-reminder computed its own separate "missing" list
 * with 7 checks (also legal_address + nodošanas vietas + stricter
 * description length + conditional PVN number). Since the two never agreed,
 * admins would see "4/5 done, only self-billing missing" while the actual
 * reminder e-mail sent to the seller listed several more items — including
 * ones the seller believed they'd already filled in — so sellers kept
 * getting the same "full checklist" e-mail even after completing almost
 * everything visible to the admin.
 *
 * Fix: both surfaces now call getSellerOnboardingChecklist() and derive
 * their own view from the same underlying `done` flags.
 */

export type SellerOnboardingInput = {
  name?: string | null;
  description: string | null;
  legal_name: string | null;
  registration_number: string | null;
  is_vat_registered?: boolean | null;
  vat_number?: string | null;
  bank_iban: string | null;
  legal_address: string | null;
  self_billing_agreed: boolean | null;
  home_locker_ids: string[] | null;
  courier_pickup_address: string | null;
};

export type OnboardingItem = {
  key: string;
  /** Full, descriptive label — used both for admin "Trūkst: ..." text and the reminder e-mail. */
  label: string;
  done: boolean;
  /** Whether this item should be listed in the seller reminder e-mail. */
  inEmailReminder: boolean;
};

export function getSellerOnboardingChecklist(s: SellerOnboardingInput): OnboardingItem[] {
  const items: OnboardingItem[] = [
    {
      key: "profile",
      label: "Profila apraksts",
      done: !!s.name && !!s.description && s.description.trim().length >= 20,
      inEmailReminder: true,
    },
    {
      key: "legal",
      label: "Juridiskā informācija (nosaukums + reģ. nr.)",
      done: !!s.legal_name && !!s.registration_number,
      inEmailReminder: true,
    },
    {
      key: "iban",
      label: "Bankas konts (IBAN)",
      done: !!s.bank_iban,
      inEmailReminder: true,
    },
    {
      key: "legal_address",
      label: "Juridiskā adrese",
      done: !!s.legal_address,
      inEmailReminder: true,
    },
    {
      key: "self_billing",
      label: "Self-billing piekrišana",
      done: !!s.self_billing_agreed,
      inEmailReminder: true,
    },
    {
      key: "dropoff",
      label: "Nodošanas vietas (pārtikas pakomāts vai kurjera adrese)",
      done: (s.home_locker_ids?.length ?? 0) > 0 || !!s.courier_pickup_address?.trim(),
      inEmailReminder: true,
    },
  ];
  // Only relevant for VAT-registered sellers — don't penalize/notify others.
  if (s.is_vat_registered) {
    items.splice(2, 0, {
      key: "vat",
      label: "PVN reģistrācijas numurs",
      done: !!s.vat_number,
      inEmailReminder: true,
    });
  }
  return items;
}
