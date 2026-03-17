import { Schema, model, models } from "mongoose";

const ConversationSchema = new Schema(
  {
    waId: { type: String, required: true, unique: true },

    currentStep: {
      type: String,
      enum: [
        "MAIN_MENU",
        "BOOKING_SERVICE",
        "BOOKING_BARBER",
        "BOOKING_DATE",
        "BOOKING_TIME",
        "BOOKING_NAME",
        "BOOKING_CONFIRM",
        "HUMAN_HANDOFF"
      ],
      default: "MAIN_MENU"
    },

    selectedServiceId: {
      type: Schema.Types.ObjectId,
      ref: "Service",
      default: null
    },
    selectedBarberId: {
      type: Schema.Types.ObjectId,
      ref: "Barber",
      default: null
    },

    selectedDate: { type: String, default: null },
    selectedTime: { type: String, default: null },
    availableSlotsCache: { type: [String], default: [] },
    customerName: { type: String, default: "" },

    needsHuman: { type: Boolean, default: false },
    handoffReason: { type: String, default: "" },
    unreadForAdmin: { type: Boolean, default: false },
    lastIncomingText: { type: String, default: "" },
    lastMessageAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

export const Conversation =
  models.Conversation || model("Conversation", ConversationSchema);
