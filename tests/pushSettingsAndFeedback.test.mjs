import test from "node:test";
import assert from "node:assert/strict";

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

test("urlBase64ToUint8Array correctly converts standard VAPID base64url keys", () => {
  // Test with standard VAPID public key
  const testKey = "BG3Fe-AQWQPk3YlPxbisDh3hFH3ai0_DkN_hsEo91V7EbbnI4SaKLA5cDjjGP7a9FZXpB8BYYMkrwz7S6g-2r2A";
  const uint8 = urlBase64ToUint8Array(testKey);

  assert.ok(uint8 instanceof Uint8Array);
  assert.equal(uint8.byteLength, 65, "P-256 uncompressed public key should be 65 bytes long");
  assert.equal(uint8[0], 0x04, "P-256 public key starts with 0x04 format byte");
});
test("Sound preferences toggle persists accurately", () => {
  const mockStorage = new Map();
  const SOUND_PREF_KEY = "maestro:sound-enabled";

  const isSoundEnabled = () => mockStorage.get(SOUND_PREF_KEY) !== "false";
  const setSoundEnabled = (val) => mockStorage.set(SOUND_PREF_KEY, val ? "true" : "false");

  // Default is true
  assert.equal(isSoundEnabled(), true);

  // Turn off
  setSoundEnabled(false);
  assert.equal(isSoundEnabled(), false);
  assert.equal(mockStorage.get(SOUND_PREF_KEY), "false");

  // Turn back on
  setSoundEnabled(true);
  assert.equal(isSoundEnabled(), true);
  assert.equal(mockStorage.get(SOUND_PREF_KEY), "true");
});

test("Push subscription payload validation", () => {
  const validateSubscriptionPayload = (body) => {
    if (!body || typeof body !== "object") return false;
    const endpoint = typeof body.endpoint === "string" && body.endpoint.startsWith("https://");
    const p256dh = typeof body.keys?.p256dh === "string" && body.keys.p256dh.length >= 16;
    const auth = typeof body.keys?.auth === "string" && body.keys.auth.length >= 8;
    return Boolean(endpoint && p256dh && auth);
  };

  const valid = {
    endpoint: "https://fcm.googleapis.com/fcm/send/fake-device-id",
    keys: {
      p256dh: "BMc7b64qK02fT10...veryLongKeyData...",
      auth: "authSecretKey123",
    },
  };
  assert.equal(validateSubscriptionPayload(valid), true);

  const missingEndpoint = {
    keys: { p256dh: "key", auth: "auth" },
  };
  assert.equal(validateSubscriptionPayload(missingEndpoint), false);

  const insecureEndpoint = {
    endpoint: "http://insecure.site/send",
    keys: { p256dh: "BMc7b64qK02fT10...veryLongKeyData...", auth: "authSecretKey123" },
  };
  assert.equal(validateSubscriptionPayload(insecureEndpoint), false);
});
