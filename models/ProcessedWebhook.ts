import { Schema, model, models } from "mongoose";

const ProcessedWebhookSchema = new Schema(
  {
    webhookId: { type: String, required: true, unique: true },
    processedAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

const ttlDays = Number(process.env.PROCESSED_WEBHOOK_TTL_DAYS || 14);
if (Number.isFinite(ttlDays) && ttlDays > 0) {
  ProcessedWebhookSchema.index(
    { processedAt: 1 },
    { expireAfterSeconds: Math.floor(ttlDays * 24 * 60 * 60) }
  );
}

export const ProcessedWebhook =
  models.ProcessedWebhook || model("ProcessedWebhook", ProcessedWebhookSchema);
