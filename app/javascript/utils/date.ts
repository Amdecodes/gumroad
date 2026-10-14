import { parseISO } from "date-fns";

import { isSupportedLocale, resolveCurrentLocale } from "$app/utils/i18n";

export const formatDate = (
  date: Date,
  options: Intl.DateTimeFormatOptions = { dateStyle: "long", timeStyle: "short" },
  locale?: string,
) => {
  const resolved = locale && isSupportedLocale(locale) ? locale : resolveCurrentLocale();
  const intlLocale = resolved === "am" ? "am-ET" : "en-US";
  return date.toLocaleString(intlLocale, options);
};

const postDateFormatOptions: Intl.DateTimeFormatOptions = { month: "long", day: "numeric", year: "numeric" };
export const formatPostDate = (date: string | null, locale: string): string =>
  (date ? parseISO(date) : new Date()).toLocaleDateString(locale, postDateFormatOptions);

export const formatCallDate = (
  date: Date,
  displayOptions: {
    date?: { hidden?: boolean; hideYear?: boolean };
    time?: { hidden?: boolean };
    timeZone?: { hidden?: boolean; userTimeZone?: string | undefined };
  } = {},
  locale?: string,
) => {
  const resolved = locale && isSupportedLocale(locale) ? locale : resolveCurrentLocale();
  const intlLocale = resolved === "am" ? "am-ET" : "en-US";
  const localeStringOptions: Intl.DateTimeFormatOptions = {};

  if (!displayOptions.date?.hidden) {
    localeStringOptions.weekday = "long";
    localeStringOptions.month = "long";
    localeStringOptions.day = "numeric";

    if (!displayOptions.date?.hideYear) {
      localeStringOptions.year = "numeric";
    }
  }

  if (!displayOptions.time?.hidden) {
    localeStringOptions.hour = "2-digit";
    localeStringOptions.minute = "2-digit";
    localeStringOptions.hour12 = true;
  }

  if (!displayOptions.timeZone?.hidden) {
    localeStringOptions.timeZone = displayOptions.timeZone?.userTimeZone;
    localeStringOptions.timeZoneName = "short";
  }

  return date.toLocaleString(intlLocale, localeStringOptions);
};
