export async function sendWhatsAppMessage(chatId: string, message: string) {
  const base = process.env.GREEN_BASE;
  const token = process.env.GREEN_TOKEN;
  const instance = process.env.GREEN_INSTANCE;

  if (!base || !token || !instance) {
    throw new Error("Green API environment variables are missing");
  }

  const url = `${base}/waInstance${instance}/sendMessage/${token}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({
      chatId,
      message,
    }),
  });

  if (!res.ok) {
    const responseText = await res.text();
    throw new Error(`Failed to send WhatsApp message (${res.status}): ${responseText}`);
  }

  return res.json();
}
