import * as React from "react";

import { classNames } from "$app/utils/classNames";
import { type SupportedLocale, useTranslation } from "$app/utils/i18n";

type LanguageToggleProps = {
  className?: string;
  variant?: "default" | "dark" | "compact";
};

export const LanguageToggle = ({ className, variant = "default" }: LanguageToggleProps) => {
  const { locale, switchLocale } = useTranslation();
  const [isPending, setIsPending] = React.useState(false);

  const handleSelect = React.useCallback(
    async (target: SupportedLocale) => {
      if (target === locale || isPending) return;
      setIsPending(true);
      try {
        await switchLocale(target);
      } finally {
        setIsPending(false);
      }
    },
    [locale, isPending, switchLocale],
  );

  const isDark = variant === "dark";

  return (
    <div
      role="group"
      aria-label="Language selection"
      className={classNames(
        "inline-flex items-center rounded-full p-0.5 text-xs font-medium transition-colors select-none",
        isDark
          ? "border border-white/20 bg-black/40 text-white/80"
          : "border border-gray-300 bg-gray-100 text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300",
        className,
      )}
    >
      <button
        type="button"
        onClick={() => {
          void handleSelect("en");
        }}
        disabled={isPending}
        aria-pressed={locale === "en"}
        className={classNames(
          "rounded-full px-2.5 py-1 transition-all",
          locale === "en"
            ? isDark
              ? "bg-white font-semibold text-black shadow-sm"
              : "bg-white font-semibold text-black shadow-sm dark:bg-gray-700 dark:text-white"
            : isDark
              ? "hover:text-white"
              : "hover:text-gray-900 dark:hover:text-white",
        )}
      >
        EN
      </button>
      <button
        type="button"
        onClick={() => {
          void handleSelect("am");
        }}
        disabled={isPending}
        aria-pressed={locale === "am"}
        className={classNames(
          "font-ethiopic rounded-full px-2.5 py-1 transition-all",
          locale === "am"
            ? isDark
              ? "bg-white font-semibold text-black shadow-sm"
              : "bg-white font-semibold text-black shadow-sm dark:bg-gray-700 dark:text-white"
            : isDark
              ? "hover:text-white"
              : "hover:text-gray-900 dark:hover:text-white",
        )}
      >
        አማ
      </button>
    </div>
  );
};
