import { Schema, model, models } from "mongoose";

const BarberSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    isActive: { type: Boolean, default: true },
    // Canonical field for barber schedule.
    workDays: { type: [Number], default: [0, 1, 2, 3, 4, 5] },
    // Backward compatibility for older docs written with a typo.
    worksDays: { type: [Number], default: undefined }
  },
  { timestamps: true }
);

export const Barber = models.Barber || model("Barber", BarberSchema);
