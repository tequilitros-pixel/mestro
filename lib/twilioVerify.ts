import "server-only";

function config() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID;
  if (!accountSid || !authToken || !serviceSid) throw new Error("Twilio Verify no está configurado");
  return { accountSid, authToken, serviceSid };
}

async function request(path: string, body: URLSearchParams) {
  const { accountSid, authToken, serviceSid } = config();
  const response = await fetch(`https://verify.twilio.com/v2/Services/${serviceSid}/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
    cache: "no-store",
  });
  const data = await response.json().catch(() => ({})) as { status?: string; message?: string };
  if (!response.ok) throw new Error(data.message || "No fue posible contactar a Twilio");
  return data;
}

export function sendSmsCode(phone: string) {
  return request("Verifications", new URLSearchParams({ To: phone, Channel: "sms" }));
}

export function checkSmsCode(phone: string, code: string) {
  return request("VerificationCheck", new URLSearchParams({ To: phone, Code: code }));
}
