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

export function isTimeHHMM(time: string) {
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(time);
}