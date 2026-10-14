import * as React from "react";

import { t } from "$app/utils/i18n";

import { Button, NavigationButton } from "$app/components/Button";
import { Modal } from "$app/components/Modal";
import { Purchase } from "$app/components/Product";

type Props = {
  purchase: Purchase;
  checkoutUrl: string;
  onClose: () => void;
};

export const SubscriptionChoiceModal = ({ purchase, checkoutUrl, onClose }: Props) => {
  const open = checkoutUrl !== "";
  const newSubscriptionHref = React.useMemo(() => {
    if (!checkoutUrl) return "";
    const url = new URL(checkoutUrl, window.location.origin);
    url.searchParams.set("force_new_subscription", "true");
    return url.toString();
  }, [checkoutUrl]);

  if (purchase.subscription_has_lapsed && purchase.membership) {
    return (
      <Modal open={open} onClose={onClose} title={t("storefront.resume_subscription_title")}>
        <p>{t("storefront.resume_subscription_desc")}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <NavigationButton href={newSubscriptionHref} target="_top">
            {t("storefront.start_new_subscription")}
          </NavigationButton>
          <NavigationButton href={purchase.membership.manage_url} color="black" target="_blank">
            {t("storefront.resume_subscription")}
          </NavigationButton>
        </div>
      </Modal>
    );
  }

  if (!purchase.membership) return null;

  return (
    <Modal open={open} onClose={onClose} title={t("storefront.already_subscribed_title")}>
      <p>{t("storefront.already_subscribed_desc")}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Button onClick={onClose}>{t("actions.cancel")}</Button>
        <NavigationButton href={newSubscriptionHref} color="black" target="_top">
          {t("storefront.start_new_subscription")}
        </NavigationButton>
      </div>
    </Modal>
  );
};
