import { Schema, model, models } from "mongoose";

const AppointmentSchema = new Schema(
  {
    waId: { type: String, required: true, trim: true },
    customerName: { type: String, required: true, trim: true },
    serviceId: {
      type: Schema.Types.ObjectId,
      ref: "Service",
      required: true,
    },
    barberId: {
      type: Schema.Types.ObjectId,
      ref: "Barber",
      required: true,
    },
    date: { type: String, required: true },
    time: { type: String, required: true },
    status: {
      type: String,
      enum: ["booked", "cancelled", "done"],
      default: "booked",
    },
    source: {
      type: String,
      enum: ["bot", "admin"],
      default: "bot",
    },
  },
  { timestamps: true }
);

AppointmentSchema.index(
  { barberId: 1, date: 1, time: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: "booked" } }
);
AppointmentSchema.index({ waId: 1, status: 1, date: 1, time: 1 });

export const Appointment =
  models.Appointment || model("Appointment", AppointmentSchema);
