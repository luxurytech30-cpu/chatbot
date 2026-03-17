import mongoose, { Schema, model, models } from "mongoose";

const MessageLogSchema = new Schema(
  {
    waId: { type: String, required: true },
    direction: {
      type: String,
      enum: ["incoming", "outgoing"],
      required: true
    },
    text: { type: String, default: "" },
    meta: { type: Object, default: {} }
  },
  { timestamps: true }
);

export const MessageLog =
  models.MessageLog || model("MessageLog", MessageLogSchema);