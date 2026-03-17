export function normalizeText(text = "") {
  return String(text)
    .toLowerCase()
    .replace(/[.,!?\u060C\u061B]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
