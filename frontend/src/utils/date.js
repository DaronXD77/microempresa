export const LA_PAZ_TZ = "America/La_Paz";

export const formatDateTimeLaPaz = (value = new Date(), locale = "es-BO") => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString(locale, { timeZone: LA_PAZ_TZ });
};

export const formatDateLaPaz = (value = new Date(), locale = "es-BO") => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString(locale, { timeZone: LA_PAZ_TZ });
};

export const formatDateTimeLaPazShort = (value, locale = "es-BO") => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString(locale, {
    timeZone: LA_PAZ_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};
