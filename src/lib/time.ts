export const getTodayISO = () => {
  const now = new Date();
  return now.toISOString().slice(0, 10);
};

export const formatTime = (value?: string) => {
  if (!value) return "—";
  const date = new Date(value);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

export const formatDateLong = (value?: string) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString([], {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric"
  });
};

export const combineDateAndTime = (dateISO: string, time: string) => {
  const [year, month, day] = dateISO.split("-").map(Number);
  const [hours, minutes] = time.split(":").map(Number);
  return new Date(year, month - 1, day, hours, minutes, 0, 0);
};

export const isLateCheckIn = (signInAt?: string, lateAfterTime?: string, dateISO?: string) => {
  if (!signInAt || !lateAfterTime || !dateISO) return false;
  const lateAfter = combineDateAndTime(dateISO, lateAfterTime);
  return new Date(signInAt).getTime() > lateAfter.getTime();
};

export const isEarlyCheckout = (
  signOutAt?: string,
  earlyCheckoutBeforeTime?: string,
  dateISO?: string
) => {
  if (!signOutAt || !earlyCheckoutBeforeTime || !dateISO) return false;
  const earlyCutoff = combineDateAndTime(dateISO, earlyCheckoutBeforeTime);
  return new Date(signOutAt).getTime() < earlyCutoff.getTime();
};
