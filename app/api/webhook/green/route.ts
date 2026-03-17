import { NextRequest, NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { requireWebhookSecret } from "@/lib/auth";
import { ProcessedWebhook } from "@/models/ProcessedWebhook";
import { processIncomingMessage } from "@/lib/chatbot";
import { sendWhatsAppMessage } from "@/lib/green-api";

export const runtime = "nodejs";
export const preferredRegion = "fra1";

export async function POST(req: NextRequest) {
  const startedAt = Date.now();
  const timings: Record<string, number> = {};
  const mark = (name: string) => {
    timings[name] = Date.now() - startedAt;
  };

  try {
    requireWebhookSecret(req);
    mark("authMs");

    const body = await req.json();
    mark("parseBodyMs");

    if (body?.typeWebhook !== "incomingMessageReceived") {
      mark("doneMs");
      console.info("[green-webhook] skipped_non_incoming", timings);
      return NextResponse.json({ ok: true, skipped: true });
    }

    if (body?.messageData?.typeMessage !== "textMessage") {
      mark("doneMs");
      console.info("[green-webhook] skipped_non_text", timings);
      return NextResponse.json({ ok: true, skipped: true });
    }

    const waId = body?.senderData?.chatId;
    const text = body?.messageData?.textMessageData?.textMessage || "";

    if (!waId || !text) {
      mark("doneMs");
      console.info("[green-webhook] skipped_missing_payload", timings);
      return NextResponse.json({ ok: true, skipped: true });
    }

    await dbConnect();
    mark("dbConnectMs");

    const webhookId =
      body?.idMessage ||
      `${body?.timestamp}_${body?.senderData?.chatId}`;

    const dedupe = await ProcessedWebhook.updateOne(
      { webhookId },
      { $setOnInsert: { webhookId, processedAt: new Date() } },
      { upsert: true }
    );
    mark("dedupeMs");

    if (!dedupe.upsertedCount) {
      mark("doneMs");
      console.info("[green-webhook] duplicate", timings);
      return NextResponse.json({ ok: true, duplicate: true });
    }

    const reply = await processIncomingMessage({ waId, text });
    mark("processIncomingMs");

    await sendWhatsAppMessage(waId, reply);
    mark("sendReplyMs");

    mark("doneMs");
    console.info("[green-webhook] ok", timings);

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    const msg = error?.message || "Internal error";
    mark("failedAtMs");
    console.error("[green-webhook] error", { msg, timings });

    if (msg === "UNAUTHORIZED_WEBHOOK") {
      return NextResponse.json({ ok: false, error: "Unauthorized webhook" }, { status: 401 });
    }

    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
