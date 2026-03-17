import { Appointment } from "@/models/Appointment";
import { Barber } from "@/models/Barber";
import { Conversation } from "@/models/Conversation";
import { Service } from "@/models/Service";
import { normalizeText } from "./normalize-text";
import { isValidChoice, isValidName, normalizeDateToISO } from "./validators";
import { generateAvailableSlots } from "./slots";
import { sendWhatsAppMessage } from "./green-api";

const GREETING_INPUTS = new Set([
  "hi",
  "hello",
  "hey",
  "start",
  "menu",
  "\u0645\u0631\u062d\u0628\u0627",
  "\u05e9\u05dc\u05d5\u05dd",
]);

const HUMAN_INPUTS = new Set([
  "5",
  "human",
  "agent",
  "support",
  "\u0645\u0648\u0638\u0641",
  "\u05e0\u05e6\u05d9\u05d2",
]);

const BOOK_INPUTS = new Set([
  "1",
  "book",
  "booking",
  "appointment",
  "\u062d\u062c\u0632",
  "\u05ea\u05d5\u05e8",
]);

const PRICE_INPUTS = new Set([
  "2",
  "price",
  "prices",
  "services",
  "cost",
  "\u0645\u062d\u064a\u0631",
  "\u0645\u062d\u064a\u0631\u064a\u0646",
  "\u0623\u0633\u0639\u0627\u0631",
  "\u05de\u05d7\u05d9\u05e8\u05d9\u05dd",
]);

const HOURS_INPUTS = new Set([
  "3",
  "hours",
  "working hours",
  "open",
  "\u0633\u0627\u0639\u0627\u062a",
  "\u0645\u0648\u0627\u0639\u064a\u062f",
  "\u05e9\u05e2\u05d5\u05ea",
]);

const LOCATION_INPUTS = new Set([
  "4",
  "location",
  "address",
  "map",
  "\u0639\u0646\u0648\u0627\u0646",
  "\u05db\u05ea\u05d5\u05d1\u05ea",
]);

const CANCEL_INPUTS = new Set([
  "6",
  "cancel",
  "cancel appointment",
  "\u0628\u062f\u064a \u0627\u0644\u063a\u064a",
  "\u05d1\u05d8\u05dc",
]);

function getShopName() {
  return process.env.SHOP_NAME || "Our Barber Shop";
}

function getOpenHour() {
  return process.env.SHOP_OPEN_HOUR || "10";
}

function getCloseHour() {
  return process.env.SHOP_CLOSE_HOUR || "20";
}

function mainMenu() {
  return (
    `Welcome to ${getShopName()}\n\n` +
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
  return `Working hours: ${getOpenHour()}:00 - ${getCloseHour()}:00`;
}

function locationReply() {
  return `${process.env.SHOP_ADDRESS || "Address not configured"}\n${process.env.SHOP_MAP_URL || ""}`.trim();
}

function slotsReply(slots: string[]) {
  let text = "Choose a time:\n\n";
  slots.forEach((slot, i) => {
    text += `${i + 1}. ${slot}\n`;
  });
  text += "\nReply with the time number.\nReply 0 for main menu.";
  return text;
}

function clearBookingState(conversation: any) {
  conversation.selectedServiceId = null;
  conversation.selectedBarberId = null;
  conversation.selectedDate = null;
  conversation.selectedTime = null;
  conversation.availableSlotsCache = [];
  conversation.customerName = "";
}

function resetConversation(conversation: any) {
  conversation.currentStep = "MAIN_MENU";
  conversation.needsHuman = false;
  conversation.handoffReason = "";
  conversation.unreadForAdmin = false;
  clearBookingState(conversation);
}

async function getOrCreateConversation(waId: string): Promise<any> {
  let conversation = await Conversation.findOne({ waId });
  if (!conversation) conversation = await Conversation.create({ waId });
  return conversation;
}

async function getActiveServices(): Promise<any[]> {
  return Service.find({ isActive: true }).sort({ createdAt: 1 });
}

async function getActiveBarbers(): Promise<any[]> {
  return Barber.find({ isActive: true }).sort({ createdAt: 1 });
}

function renderServices(services: any[]) {
  let text = "Choose a service:\n\n";
  services.forEach((service, i) => {
    text += `${i + 1}. ${service.name} - ILS ${service.price}\n`;
  });
  text += "\nReply with the service number.\nReply 0 for main menu.";
  return text;
}

function renderBarbers(barbers: any[]) {
  let text = "Choose a barber:\n\n";
  barbers.forEach((barber, i) => {
    text += `${i + 1}. ${barber.name}\n`;
  });
  text += "\nReply with the barber number.\nReply 0 for main menu.";
  return text;
}

async function pricesReply() {
  const services = await getActiveServices();
  if (!services.length) return "No services available right now.";

  let text = "Prices:\n\n";
  services.forEach((service, i) => {
    text += `${i + 1}. ${service.name} - ILS ${service.price}\n`;
  });
  text += "\nReply 1 to book.";
  return text;
}

function parseCancelCommand(normalized: string) {
  const match = normalized.match(/^cancel\s+(\d+)$/i);
  if (!match) return null;
  return Number(match[1]) - 1;
}

async function getBookedAppointments(waId: string) {
  return Appointment.find({ waId, status: "booked" })
    .populate("serviceId", "name")
    .populate("barberId", "name")
    .sort({ date: 1, time: 1 });
}

async function listBookedAppointmentsReply(waId: string) {
  const booked = await getBookedAppointments(waId);
  if (!booked.length) return "You do not have any active appointments.";

  let reply = "Your active appointments:\n\n";
  booked.forEach((appointment: any, i: number) => {
    reply += `${i + 1}. ${appointment.date} ${appointment.time} - ${appointment.serviceId?.name || "-"} - ${appointment.barberId?.name || "-"}\n`;
  });
  reply += "\nReply: cancel 1 OR cancel 2";
  return reply;
}

async function cancelAppointmentByIndex(waId: string, index: number) {
  if (index < 0) return "Invalid cancellation number.";

  const booked = await Appointment.find({ waId, status: "booked" }).sort({ date: 1, time: 1 });
  if (!booked[index]) return "Invalid cancellation number.";

  booked[index].status = "cancelled";
  await booked[index].save();
  return "Appointment cancelled successfully.";
}

async function notifyAdmin(waId: string, reason: string, text: string) {
  if (!process.env.ADMIN_NOTIFY_CHAT_ID) return;

  const msg =
    `Human handoff request\n` +
    `Customer: ${waId}\n` +
    `Reason: ${reason}\n` +
    `Last message: ${text}`;

  try {
    await sendWhatsAppMessage(process.env.ADMIN_NOTIFY_CHAT_ID, msg);
  } catch (error: any) {
    console.error("[chatbot] admin_notification_failed", error?.message || error);
  }
}

export async function processIncomingMessage({
  waId,
  text,
}: {
  waId: string;
  text: string;
}): Promise<string> {
  const normalized = normalizeText(text);
  const conversation = await getOrCreateConversation(waId);

  conversation.lastIncomingText = text;
  conversation.lastMessageAt = new Date();

  if (normalized === "0" || GREETING_INPUTS.has(normalized)) {
    resetConversation(conversation);
    await conversation.save();
    return mainMenu();
  }

  if (conversation.needsHuman || conversation.currentStep === "HUMAN_HANDOFF") {
    conversation.unreadForAdmin = true;
    await conversation.save();
    return "A team member will reply to you soon.";
  }

  if (HUMAN_INPUTS.has(normalized)) {
    conversation.needsHuman = true;
    conversation.currentStep = "HUMAN_HANDOFF";
    conversation.handoffReason = "customer_requested_human";
    conversation.unreadForAdmin = true;
    await conversation.save();
    await notifyAdmin(waId, "customer_requested_human", text);
    return "A team member will reply to you soon.";
  }

  const cancelIndex = parseCancelCommand(normalized);
  if (cancelIndex !== null) {
    return cancelAppointmentByIndex(waId, cancelIndex);
  }

  if (CANCEL_INPUTS.has(normalized)) {
    return listBookedAppointmentsReply(waId);
  }

  if (conversation.currentStep === "MAIN_MENU") {
    if (BOOK_INPUTS.has(normalized)) {
      const services = await getActiveServices();
      if (!services.length) return "No services available right now.";
      conversation.currentStep = "BOOKING_SERVICE";
      await conversation.save();
      return renderServices(services);
    }

    if (PRICE_INPUTS.has(normalized)) {
      await conversation.save();
      return pricesReply();
    }

    if (HOURS_INPUTS.has(normalized)) {
      await conversation.save();
      return hoursReply();
    }

    if (LOCATION_INPUTS.has(normalized)) {
      await conversation.save();
      return locationReply();
    }

    await conversation.save();
    return mainMenu();
  }

  if (conversation.currentStep === "BOOKING_SERVICE") {
    const services = await getActiveServices();
    if (!services.length) {
      resetConversation(conversation);
      await conversation.save();
      return "No services available right now.\n\n" + mainMenu();
    }

    if (!isValidChoice(normalized, services.length)) {
      return "Invalid service number. Reply with one of the listed numbers.";
    }

    const selected = services[Number(normalized) - 1];
    conversation.selectedServiceId = selected._id;
    conversation.currentStep = "BOOKING_BARBER";
    await conversation.save();

    const barbers = await getActiveBarbers();
    if (!barbers.length) {
      resetConversation(conversation);
      await conversation.save();
      return "No barbers available right now.\n\n" + mainMenu();
    }

    return renderBarbers(barbers);
  }

  if (conversation.currentStep === "BOOKING_BARBER") {
    const barbers = await getActiveBarbers();
    if (!barbers.length) {
      resetConversation(conversation);
      await conversation.save();
      return "No barbers available right now.\n\n" + mainMenu();
    }

    if (!isValidChoice(normalized, barbers.length)) {
      return "Invalid barber number. Reply with one of the listed numbers.";
    }

    const selected = barbers[Number(normalized) - 1];
    conversation.selectedBarberId = selected._id;
    conversation.currentStep = "BOOKING_DATE";
    await conversation.save();
    return "Send date in this format: YYYY-MM-DD (or DD.MM.YYYY).";
  }

  if (conversation.currentStep === "BOOKING_DATE") {
    const isoDate = normalizeDateToISO(text);
    if (!isoDate) return "Invalid date format. Use YYYY-MM-DD or DD.MM.YYYY.";

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
    if (!slots.length) {
      conversation.currentStep = "BOOKING_DATE";
      await conversation.save();
      return "No time slots cached. Please send the date again in YYYY-MM-DD format.";
    }

    if (!isValidChoice(normalized, slots.length)) {
      return "Invalid time number. Reply with one of the listed numbers.";
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

    conversation.customerName = text.trim().replace(/\s+/g, " ");
    conversation.currentStep = "BOOKING_CONFIRM";
    await conversation.save();

    const [service, barber] = await Promise.all([
      Service.findById(conversation.selectedServiceId),
      Barber.findById(conversation.selectedBarberId),
    ]);

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

    resetConversation(conversation);
    await conversation.save();

    return "Appointment booked successfully.\n\n" + mainMenu();
  }

  resetConversation(conversation);
  await conversation.save();
  return mainMenu();
}
