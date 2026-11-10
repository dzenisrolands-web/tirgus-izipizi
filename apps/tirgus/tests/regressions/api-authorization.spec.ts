import { test, expect } from "@playwright/test";
import * as approveSeller from "../../app/api/admin/approve-seller/route";
import * as deleteSeller from "../../app/api/admin/delete-seller/route";
import * as deleteUser from "../../app/api/admin/delete-user/route";
import * as emailPreview from "../../app/api/admin/email-preview/route";
import * as emailTemplates from "../../app/api/admin/email-templates/route";
import * as feedback from "../../app/api/admin/feedback/route";
import * as invoices from "../../app/api/admin/generate-invoices/route";
import * as slugs from "../../app/api/admin/generate-slugs/route";
import * as impersonate from "../../app/api/admin/impersonate/route";
import * as inviteBatch from "../../app/api/admin/invite/batch/route";
import * as invite from "../../app/api/admin/invite/route";
import * as linkSeller from "../../app/api/admin/link-seller/route";
import * as makeSeller from "../../app/api/admin/make-seller/route";
import * as diagnostics from "../../app/api/admin/paysera-diagnostics/route";
import * as shipments from "../../app/api/admin/sutijumi/route";
import * as team from "../../app/api/admin/team/route";
import * as emailTest from "../../app/api/admin/test-email/route";
import * as status from "../../app/api/admin/update-order-status/route";
import * as users from "../../app/api/admin/users/route";
import * as deleteAccount from "../../app/api/account/delete/route";
import * as removeSeller from "../../app/api/account/remove-seller/route";
import * as confirm from "../../app/api/seller/confirm-order/route";
import * as orderNotify from "../../app/api/notify/order-status/route";
import * as reminder from "../../app/api/notify/seller-reminder/route";
import * as subscribePush from "../../app/api/push/subscribe/route";
import * as lockerSubscriptions from "../../app/api/locker-subscriptions/route";
import * as drop from "../../app/api/checkout/drop/route";
import * as ship from "../../app/api/shipments/create-from-order/route";
import * as expire from "../../app/api/cron/expire-drops/route";
import * as invoiceCron from "../../app/api/cron/generate-invoices/route";
import * as reminders from "../../app/api/cron/order-reminders/route";
import * as invitesCron from "../../app/api/cron/send-invites/route";

type Handlers = Record<string, (req: Request) => Promise<Response>>;
const modules: Record<string, Handlers> = {
  "admin/approve-seller": approveSeller, "admin/delete-seller": deleteSeller, "admin/delete-user": deleteUser,
  "admin/email-preview": emailPreview, "admin/email-templates": emailTemplates, "admin/feedback": feedback,
  "admin/generate-invoices": invoices, "admin/generate-slugs": slugs, "admin/impersonate": impersonate,
  "admin/invite/batch": inviteBatch, "admin/invite": invite, "admin/link-seller": linkSeller,
  "admin/make-seller": makeSeller, "admin/paysera-diagnostics": diagnostics, "admin/sutijumi": shipments,
  "admin/team": team, "admin/test-email": emailTest, "admin/update-order-status": status, "admin/users": users,
  "account/delete": deleteAccount, "account/remove-seller": removeSeller, "seller/confirm-order": confirm,
  "notify/order-status": orderNotify, "notify/seller-reminder": reminder, "push/subscribe": subscribePush,
  "locker-subscriptions": lockerSubscriptions, "checkout/drop": drop, "shipments/create-from-order": ship,
  "cron/expire-drops": expire, "cron/generate-invoices": invoiceCron, "cron/order-reminders": reminders, "cron/send-invites": invitesCron,
};

const adminRoutes = [
  ["approve-seller", "POST"], ["delete-seller", "POST"], ["delete-user", "POST"],
  ["email-preview", "GET", "POST"], ["email-templates", "GET", "PUT"], ["feedback", "GET", "PATCH"],
  ["generate-invoices", "POST"], ["generate-slugs", "POST"], ["impersonate", "POST"],
  ["invite/batch", "POST"], ["invite", "GET", "POST"], ["link-seller", "POST"],
  ["make-seller", "POST"], ["paysera-diagnostics", "GET", "POST"], ["sutijumi", "GET", "POST"],
  ["team", "GET", "POST", "DELETE"], ["test-email", "POST"], ["update-order-status", "POST"], ["users", "GET"],
];

for (const [route, ...methods] of adminRoutes) {
  test(`admin/${route}: anonymous and ordinary users cannot reach privileged data or actions`, async () => {
    const handlers = modules[`admin/${route}`];
    const original = globalThis.fetch;
    let authenticated = false;
    globalThis.fetch = async input => {
      const url = new URL(String(input));
      if (authenticated && url.origin === "https://example.invalid" && url.pathname === "/auth/v1/user") {
        return Response.json({ id: "buyer", app_metadata: {}, user_metadata: { is_super_admin: true } });
      }
      throw new Error("Protected routes must not access data or send notifications");
    };
    try {
      for (const withToken of [false, true]) {
        authenticated = withToken;
        for (const method of methods) {
          const req = new Request(`https://example.invalid/api/admin/${route}`, {
            method, headers: withToken ? { authorization: "Bearer dummy-token" } : {},
          });
          expect([401, 403]).toContain((await handlers[method](req)).status);
        }
      }
    } finally { globalThis.fetch = original; }
  });
}

for (const [route, ...methods] of [
  ["account/delete", "POST"], ["account/remove-seller", "POST"], ["seller/confirm-order", "POST"],
  ["notify/order-status", "POST"], ["notify/seller-reminder", "POST"], ["push/subscribe", "POST", "DELETE"],
  ["locker-subscriptions", "GET", "POST", "DELETE"], ["checkout/drop", "POST"], ["shipments/create-from-order", "POST"],
  ["cron/expire-drops", "GET"], ["cron/generate-invoices", "GET"], ["cron/order-reminders", "GET"], ["cron/send-invites", "GET"],
]) {
  test(`${route}: anonymous requests fail closed (also when CRON_SECRET is missing)`, async () => {
    const handlers = modules[route];
    delete process.env.CRON_SECRET;
    const original = globalThis.fetch;
    globalThis.fetch = async () => { throw new Error("Anonymous requests cannot access backend or notifications"); };
    try {
      for (const method of methods) {
        expect((await handlers[method](new Request(`https://example.invalid/api/${route}`, { method }))).status).toBe(401);
      }
    } finally { globalThis.fetch = original; }
  });
}
