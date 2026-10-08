import * as React from "react";

import { classNames } from "$app/utils/classNames";

import { useDomains } from "$app/components/DomainSettings";
import { LanguageToggle } from "$app/components/LanguageToggle";
import { Logo } from "$app/components/Logo";

// `currencySelector` controls the accessory bar (language toggle) on storefront footers.
export const PoweredByFooter = ({
  className,
  currencySelector = false,
  shownCurrency: _shownCurrency,
}: {
  className?: string | undefined;
  currencySelector?: boolean | undefined;
  shownCurrency?: string | null | undefined;
}) => {
  const { rootDomain } = useDomains();

  return (
    <footer
      className={classNames(
        "px-4 py-8 lg:py-16",
        currencySelector
          ? "flex flex-col items-center gap-4 text-center sm:flex-row sm:justify-between sm:text-left"
          : "text-center",
        className,
      )}
    >
      <div>
        Powered by{" "}
        <a href={Routes.root_url({ host: rootDomain })}>
          <Logo />
        </a>
      </div>
      {currencySelector ? (
        <div className="flex items-center gap-3">
          <LanguageToggle variant="compact" />
        </div>
      ) : null}
      {/* The product page's buy bar is fixed over the end of the page on mobile; this reserves its
          height (0 anywhere else, and on desktop, where the bar is at the top). */}
      <div aria-hidden className="h-[var(--product-cta-bar-height,0px)]" />
    </footer>
  );
};
