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
        "flex flex-col items-center gap-4 px-4 py-8 text-center sm:flex-row sm:justify-between sm:text-left lg:py-16",
        className,
      )}
    >
      <div>
        Powered by{" "}
        <a href={Routes.root_url({ host: rootDomain })}>
          <Logo />
        </a>
      </div>
      <div className="flex items-center gap-3">
        <LanguageToggle variant="compact" />
      </div>
      {/* The product page's buy bar is fixed over the end of the page on mobile; this reserves its
          height (0 anywhere else, and on desktop, where the bar is at the top). */}
      <div aria-hidden className="h-[var(--product-cta-bar-height,0px)]" />
    </footer>
  );
};
