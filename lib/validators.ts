export function isValidName(name: string) {
  return typeof name === "string" && name.trim().length >= 2;
}

export function isValidChoice(text: string, max: number) {
  const n = Number(text);
  return Number.isInteger(n) && n >= 1 && n <= max;
}

export function isISODate(dateStr: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(dateStr);
}

function toAsciiDigits(input: string) {
  return input
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[\u06f0-\u06f9]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[\uff10-\uff19]/g, (d) => String(d.charCodeAt(0) - 0xff10));
}

export function normalizeDateToISO(input: string) {
  const cleaned = toAsciiDigits(String(input || ""))
    .trim()
    .replace(/\s+/g, "")
    .replace(/[/.]/g, "-");

  const match = cleaned.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const dt = new Date(year, month - 1, day);
  if (
    dt.getFullYear() !== year ||
    dt.getMonth() !== month - 1 ||
    dt.getDate() !== day
  ) {
    return null;
  }

  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function isTimeHHMM(time: string) {
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(time);
}
