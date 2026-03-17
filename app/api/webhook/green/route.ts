import { NextRequest, NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { requireWebhookSecret } from "@/lib/auth";
import { ProcessedWebhook } from "@/models/ProcessedWebhook";
import { MessageLog } from "@/models/MessageLog";
import { processIncomingMessage } from "@/lib/chatbot";
import { sendWhatsAppMessage } from "@/lib/green-api";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    requireWebhookSecret(req);
    await dbConnect();

    const body = await req.json();

    if (body?.typeWebhook !== "incomingMessageReceived") {
      return NextResponse.json({ ok: true, skipped: true });
    }

    if (body?.messageData?.typeMessage !== "textMessage") {
      return NextResponse.json({ ok: true, skipped: true });
    }

    const webhookId =
      body?.idMessage ||
      `${body?.timestamp}_${body?.senderData?.chatId}`;

    const exists = await ProcessedWebhook.findOne({ webhookId });
    if (exists) {
      return NextResponse.json({ ok: true, duplicate: true });
    }

    const waId = body?.senderData?.chatId;
    const text = body?.messageData?.textMessageData?.textMessage || "";

    if (!waId || !text) {
      return NextResponse.json({ ok: true, skipped: true });
    }

    await ProcessedWebhook.create({ webhookId });

    await MessageLog.create({
      waId,
      direction: "incoming",
      text,
      meta: { webhookId },
    });

    const reply = await processIncomingMessage({ waId, text });

    await sendWhatsAppMessage(waId, reply);

    await MessageLog.create({
      waId,
      direction: "outgoing",
      text: reply,
      meta: {},
    });

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    const msg = error?.message || "Internal error";

    if (msg === "UNAUTHORIZED_WEBHOOK") {
      return NextResponse.json({ ok: false, error: "Unauthorized webhook" }, { status: 401 });
    }

    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}