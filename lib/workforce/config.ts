import "server-only";

export function workforceV1Enabled() {
  return process.env.WORKFORCE_V1_ENABLED === "true";
}
