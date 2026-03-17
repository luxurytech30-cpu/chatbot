import mongoose, { Schema, model, models } from "mongoose";

const ProcessedWebhookSchema = new Schema(
  {
    webhookId: { type: String, required: true, unique: true },
    processedAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

export const ProcessedWebhook =
  models.ProcessedWebhook || model("ProcessedWebhook", ProcessedWebhookSchema);