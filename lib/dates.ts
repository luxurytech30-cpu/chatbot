import { isISODate } from "./validators";

export function parseDateOnly(dateStr: string) {
  if (!isISODate(dateStr)) return null;

  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);

  if (
    dt.getFullYear() !== y ||
    dt.getMonth() !== m - 1 ||
    dt.getDate() !== d
  ) {
    return null;
  }

  return dt;
}

export function todayLocal() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export function diffDaysFromToday(dateStr: string) {
  const dt = parseDateOnly(dateStr);
  if (!dt) return null;
  const oneDay = 24 * 60 * 60 * 1000;
  return Math.round((dt.getTime() - todayLocal().getTime()) / oneDay);
}

export function getDayOfWeek(dateStr: string) {
  const dt = parseDateOnly(dateStr);
  return dt ? dt.getDay() : null;
}

export function timeToMinutes(time: string) {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}