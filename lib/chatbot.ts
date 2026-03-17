import { Appointment } from "@/models/Appointment";
import { Barber } from "@/models/Barber";
import { Conversation } from "@/models/Conversation";
import { Service } from "@/models/Service";
import { normalizeText } from "./normalize-text";
import { isValidChoice, isValidName, normalizeDateToISO } from "./validators";
import { generateAvailableSlots } from "./slots";
import { sendWhatsAppMessage } from "./green-api";

function mainMenu() {
  return (
    `💈 Welcome to ${process.env.SHOP_NAME}\n\n` +
    `Reply with a number:\n` +
    `1. Book appointment\n` +
    `2. Prices\n` +
    `3. Working hours\n` +
    `4. Location\n` +
    `5. Talk to human\n` +
    `6. Cancel my appointment`
  );
}

function hoursReply() {
  return `🕒 Working hours: ${process.env.SHOP_OPEN_HOUR}:00 - ${process.env.SHOP_CLOSE_HOUR}:00`;
}

function locationReply() {
  return `📍 ${process.env.SHOP_ADDRESS}\n${process.env.SHOP_MAP_URL}`;
}

async function getOrCreateConversation(waId: string) {
  let conversation = await Conversation.findOne({ waId });
  if (!conversation) {
    conversation = await Conversation.create({ waId });
  }
  return conversation;
}

async function pricesReply() {
  const services = await Service.find({ isActive: true }).sort({ createdAt: 1 });
  if (!services.length) return "No services available right now.";

  let text = "💈 Prices:\n\n";
  services.forEach((s: any, i: number) => {
    text += `${i + 1}. ${s.name} - ₪${s.price}\n`;
  });
  text += "\nReply 1 to book.";
  return text;
}

async function serviceSelectionReply() {
  const services = await Service.find({ isActive: true }).sort({ createdAt: 1 });
  let text = "Choose a service:\n\n";
  services.forEach((s: any, i: number) => {
    text += `${i + 1}. ${s.name} - ₪${s.price}\n`;
  });
  text += "\nReply with the service number.\nReply 0 for main menu.";
  return { text, services };
}

async function barberSelectionReply() {
  const barbers = await Barber.find({ isActive: true }).sort({ createdAt: 1 });
  let text = "Choose a barber:\n\n";
  barbers.forEach((b: any, i: number) => {
    text += `${i + 1}. ${b.name}\n`;
  });
  text += "\nReply with the barber number.\nReply 0 for main menu.";
  return { text, barbers };
}

function slotsReply(slots: string[]) {
  let text = "Choose a time:\n\n";
  slots.forEach((slot, i) => {
    text += `${i + 1}. ${slot}\n`;
  });
  text += "\nReply with the time number.\nReply 0 for main menu.";
  return text;
}

async function notifyAdmin(waId: string, reason: string, text: string) {
  if (!process.env.ADMIN_NOTIFY_CHAT_ID) return;
  const msg =
    `🚨 Human handoff request\n` +
    `Customer: ${waId}\n` +
    `Reason: ${reason}\n` +
    `Last message: ${text}`;
  await sendWhatsAppMessage(process.env.ADMIN_NOTIFY_CHAT_ID, msg);
}

export async function processIncomingMessage({
  waId,
  text,
}: {
  waId: string;
  text: string;
}) : Promise<string> {
  const normalized = normalizeText(text);
  const conversation = await getOrCreateConversation(waId);

  conversation.lastIncomingText = text;
  conversation.lastMessageAt = new Date();

  const isGreeting = ["hi", "hello", "hey", "مرحبا", "שלום", "start", "menu"].includes(normalized);
  const humanRequest = ["5", "human", "agent", "support", "موظف", "נציג"].includes(normalized);
  const cancelRequest = ["6", "cancel", "cancel appointment", "بدي الغي", "בטל"].includes(normalized);

  if (normalized === "0" || isGreeting) {
    conversation.currentStep = "MAIN_MENU";
    conversation.needsHuman = false;
    conversation.handoffReason = "";
    conversation.unreadForAdmin = false;
    conversation.selectedServiceId = null;
    conversation.selectedBarberId = null;
    conversation.selectedDate = null;
    conversation.selectedTime = null;
    conversation.availableSlotsCache = [];
    conversation.customerName = "";
    await conversation.save();
    return mainMenu();
  }

  if (conversation.needsHuman || conversation.currentStep === "HUMAN_HANDOFF") {
    conversation.unreadForAdmin = true;
    await conversation.save();
    return "A team member will reply to you soon.";
  }

  if (humanRequest) {
    conversation.needsHuman = true;
    conversation.currentStep = "HUMAN_HANDOFF";
    conversation.handoffReason = "customer_requested_human";
    conversation.unreadForAdmin = true;
    await conversation.save();
    await notifyAdmin(waId, "customer_requested_human", text);
    return "A team member will reply to you soon.";
  }

  if (conversation.currentStep === "MAIN_MENU") {
    if (["1", "book", "booking", "appointment", "حجز", "תור"].includes(normalized)) {
      const { text: reply } = await serviceSelectionReply();
      conversation.currentStep = "BOOKING_SERVICE";
      await conversation.save();
      return reply;
    }

    if (["2", "price", "prices", "services", "cost", "מחירים", "أسعار"].includes(normalized)) {
      await conversation.save();
      return pricesReply();
    }

    if (["3", "hours", "working hours", "open", "שעות", "مواعيد"].includes(normalized)) {
      await conversation.save();
      return hoursReply();
    }

    if (["4", "location", "address", "map", "כתובת", "عنوان"].includes(normalized)) {
      await conversation.save();
      return locationReply();
    }

    if (cancelRequest) {
      const booked = await Appointment.find({ waId, status: "booked" })
        .populate("serviceId", "name")
        .populate("barberId", "name")
        .sort({ date: 1, time: 1 });

      if (!booked.length) return "You do not have any active appointments.";

      let reply = "Your active appointments:\n\n";
      booked.forEach((a: any, i: number) => {
        reply += `${i + 1}. ${a.date} ${a.time} - ${a.serviceId?.name} - ${a.barberId?.name}\n`;
      });
      reply += "\nReply: cancel 1  OR  cancel 2";
      return reply;
    }

    await conversation.save();
    return mainMenu();
  }

  if (conversation.currentStep === "BOOKING_SERVICE") {
    const { services } = await serviceSelectionReply();

    if (!isValidChoice(normalized, services.length)) {
      return "Invalid service number.";
    }

    const selected = services[Number(normalized) - 1];
    conversation.selectedServiceId = selected._id;
    conversation.currentStep = "BOOKING_BARBER";
    await conversation.save();

    const { text: reply } = await barberSelectionReply();
    return reply;
  }

  if (conversation.currentStep === "BOOKING_BARBER") {
    const { barbers } = await barberSelectionReply();

    if (!isValidChoice(normalized, barbers.length)) {
      return "Invalid barber number.";
    }

    const selected = barbers[Number(normalized) - 1];
    conversation.selectedBarberId = selected._id;
    conversation.currentStep = "BOOKING_DATE";
    await conversation.save();

    return "Send date in this format: YYYY-MM-DD";
  }

  if (conversation.currentStep === "BOOKING_DATE") {
    const isoDate = normalizeDateToISO(text);
    if (!isoDate) return "Invalid date format. Use YYYY-MM-DD.";

    const slotResult = await generateAvailableSlots({
      barberId: String(conversation.selectedBarberId),
      serviceId: String(conversation.selectedServiceId),
      date: isoDate,
    });

    if (!slotResult.ok) return slotResult.message;
    if (!slotResult.slots.length) return "No available slots on this date. Send another date.";

    conversation.selectedDate = isoDate;
    conversation.availableSlotsCache = slotResult.slots;
    conversation.currentStep = "BOOKING_TIME";
    await conversation.save();

    return slotsReply(slotResult.slots);
  }

  if (conversation.currentStep === "BOOKING_TIME") {
    const slots = conversation.availableSlotsCache || [];

    if (!isValidChoice(normalized, slots.length)) {
      return "Invalid time number.";
    }

    conversation.selectedTime = slots[Number(normalized) - 1];
    conversation.currentStep = "BOOKING_NAME";
    await conversation.save();

    return "Send your full name.";
  }

  if (conversation.currentStep === "BOOKING_NAME") {
    if (!isValidName(text)) {
      return "Please send a valid full name.";
    }

    conversation.customerName = text.trim();
    conversation.currentStep = "BOOKING_CONFIRM";
    await conversation.save();

    const service = await Service.findById(conversation.selectedServiceId);
    const barber = await Barber.findById(conversation.selectedBarberId);

    return (
      `Confirm your appointment:\n\n` +
      `Name: ${conversation.customerName}\n` +
      `Service: ${service?.name || "-"}\n` +
      `Barber: ${barber?.name || "-"}\n` +
      `Date: ${conversation.selectedDate}\n` +
      `Time: ${conversation.selectedTime}\n\n` +
      `Reply 1 to confirm\n` +
      `Reply 0 for menu`
    );
  }

  if (conversation.currentStep === "BOOKING_CONFIRM") {
    if (normalized !== "1") {
      return "Reply 1 to confirm or 0 for menu.";
    }

    const existing = await Appointment.findOne({
      barberId: conversation.selectedBarberId,
      date: conversation.selectedDate,
      time: conversation.selectedTime,
      status: "booked",
    });

    if (existing) {
      const slotResult = await generateAvailableSlots({
        barberId: String(conversation.selectedBarberId),
        serviceId: String(conversation.selectedServiceId),
        date: String(conversation.selectedDate),
      });

      conversation.currentStep = "BOOKING_TIME";
      conversation.availableSlotsCache = slotResult.ok ? slotResult.slots : [];
      conversation.selectedTime = null;
      await conversation.save();

      if (!slotResult.ok || !slotResult.slots.length) {
        return "That time was just taken. Send another date.";
      }

      return `That time is no longer available.\n\n${slotsReply(slotResult.slots)}`;
    }

    await Appointment.create({
      waId,
      customerName: conversation.customerName,
      serviceId: conversation.selectedServiceId,
      barberId: conversation.selectedBarberId,
      date: conversation.selectedDate,
      time: conversation.selectedTime,
      status: "booked",
      source: "bot",
    });

    conversation.currentStep = "MAIN_MENU";
    conversation.selectedServiceId = null;
    conversation.selectedBarberId = null;
    conversation.selectedDate = null;
    conversation.selectedTime = null;
    conversation.availableSlotsCache = [];
    conversation.customerName = "";
    await conversation.save();

    return "✅ Appointment booked successfully.\n\n" + mainMenu();
  }

  if (/^cancel\s+\d+$/i.test(normalized)) {
    const index = Number(normalized.split(" ")[1]) - 1;
    const booked = await Appointment.find({ waId, status: "booked" }).sort({ date: 1, time: 1 });

    if (!booked[index]) return "Invalid cancellation number.";

    booked[index].status = "cancelled";
    await booked[index].save();

    return "❌ Appointment cancelled successfully.";
  }

  return mainMenu();
}
