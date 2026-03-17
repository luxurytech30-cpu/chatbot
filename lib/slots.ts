import { Appointment } from "@/models/Appointment";
import { Barber } from "@/models/Barber";
import { Service } from "@/models/Service";
import { diffDaysFromToday, getDayOfWeek, timeToMinutes } from "./dates";

type AvailableSlotsResult =
  | { ok: true; slots: string[] }
  | { ok: false; message: string };

export async function generateAvailableSlots({
  barberId,
  serviceId,
  date,
}: {
  barberId: string;
  serviceId: string;
  date: string;
}): Promise<AvailableSlotsResult> {
  const barber = await Barber.findById(barberId);
  const service = await Service.findById(serviceId);

  if (!barber || !barber.isActive) {
    return { ok: false, message: "Selected barber is not available." };
  }

  if (!service || !service.isActive) {
    return { ok: false, message: "Selected service is not available." };
  }

  const daysAhead = Number(process.env.BOOKING_DAYS_AHEAD || 30);
  const diff = diffDaysFromToday(date);

  if (diff === null) {
    return { ok: false, message: "Invalid date." };
  }

  if (diff < 0) {
    return { ok: false, message: "You cannot book past dates." };
  }

  if (diff > daysAhead) {
    return { ok: false, message: `You can only book up to ${daysAhead} days ahead.` };
  }

  const dow = getDayOfWeek(date);
  const workDays = Array.isArray((barber as any).workDays)
    ? (barber as any).workDays
    : Array.isArray((barber as any).worksDays)
      ? (barber as any).worksDays
      : [];

  if (dow === null || !workDays.includes(dow)) {
    return { ok: false, message: "This barber does not work on that day." };
  }

  const openHour = Number(process.env.SHOP_OPEN_HOUR || 10);
  const closeHour = Number(process.env.SHOP_CLOSE_HOUR || 20);
  const interval = Number(process.env.SHOP_SLOT_INTERVAL_MIN || 30);
  const duration = service.durationMin;

  if (!Number.isFinite(openHour) || !Number.isFinite(closeHour) || openHour >= closeHour) {
    return { ok: false, message: "Shop hours are not configured correctly." };
  }

  if (!Number.isFinite(interval) || interval <= 0) {
    return { ok: false, message: "Slot interval is not configured correctly." };
  }

  const booked = await Appointment.find({
    barberId,
    date,
    status: "booked"
  })
    .populate("serviceId", "durationMin")
    .sort({ time: 1 });

  const bookedRanges = booked.map((a: any) => ({
    start: timeToMinutes(a.time),
    end: timeToMinutes(a.time) + Number(a?.serviceId?.durationMin || 60)
  }));

  const slots: string[] = [];
  const startMinutes = openHour * 60;
  const endMinutes = closeHour * 60;

  for (let t = startMinutes; t + duration <= endMinutes; t += interval) {
    const start = t;
    const end = t + duration;

    const overlaps = bookedRanges.some(
      (b: { start: number; end: number }) => start < b.end && end > b.start
    );

    if (!overlaps) {
      const hh = String(Math.floor(start / 60)).padStart(2, "0");
      const mm = String(start % 60).padStart(2, "0");
      slots.push(`${hh}:${mm}`);
    }
  }

  return { ok: true, slots };
}
