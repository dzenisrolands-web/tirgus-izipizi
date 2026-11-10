import { test, expect } from "@playwright/test";
import { isTrustedPushEndpoint } from "../../lib/push-endpoint";

test("push destinations are browser-provider HTTPS endpoints, never arbitrary/internal URLs", () => {
  for (const endpoint of [
    "https://fcm.googleapis.com/fcm/send/token",
    "https://updates.push.services.mozilla.com/wpush/v2/token",
    "https://web.push.apple.com/token",
    "https://wns.notify.windows.com/token",
  ]) expect(isTrustedPushEndpoint(endpoint)).toBe(true);
  for (const endpoint of [
    null, "", "https://127.0.0.1", "https://[::1]", "http://169.254.169.254",
    "https://localhost", "https://fcm.googleapis.com.evil.invalid/token",
    "https://fcm.googleapis.com@evil.invalid/token", "https://fcm.googleapis.com:8443/token",
  ]) expect(isTrustedPushEndpoint(endpoint)).toBe(false);
});
