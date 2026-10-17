import { Cart } from "@boxicons/react";
import * as React from "react";

import { hasCartItems } from "$app/utils/cart";

import { NavigationButton } from "$app/components/Button";
import { useCartItemsCount } from "$app/components/Checkout/useCartItemsCount";
import { useAppDomain } from "$app/components/DomainSettings";
import { useTranslation } from "$app/utils/i18n";

export const CartNavigationButton = ({ className }: { className?: string }) => {
  const appDomain = useAppDomain();
  const cartItemsCount = useCartItemsCount();
  const { locale } = useTranslation();

  return hasCartItems(cartItemsCount) ? (
    <NavigationButton className={className} color="filled" href={Routes.checkout_url({ host: appDomain, locale })}>
      <Cart pack="filled" className="size-5" />
      {cartItemsCount}
    </NavigationButton>
  ) : null;
};
