import { NextRequest } from "next/server";

function readBearerToken(authorizationHeader: string | null) {
  if (!authorizationHeader) return "";
  return authorizationHeader.replace(/^Bearer\s+/i, "").trim();
}

export function requierAdmn(req: NextRequest) {
  const expected = process.env.ADMIN_TOKEN?.trim();
  const incoming = req.headers.get("x-admin-token")?.trim() || "";

  if (!expected || incoming !== expected) {
    throw new Error("UNAUTHORIZED_ADMIN");
  }
}

export function requireWebhookSecret(req: NextRequest) {
  const expected = process.env.WEBHOOK_SECRET?.trim();

  // Allow disabling webhook auth in local/dev if WEBHOOK_SECRET is unset.
  if (!expected) return;

  const fromCustomHeader = req.headers.get("x-webhook-secret")?.trim() || "";
  const fromAuthHeader = readBearerToken(req.headers.get("authorization"));
  const fromQuery = req.nextUrl.searchParams.get("secret")?.trim() || "";
  const incoming = fromCustomHeader || fromAuthHeader || fromQuery;

  if (!incoming || incoming !== expected) {
    throw new Error("UNAUTHORIZED_WEBHOOK");
  }
}
