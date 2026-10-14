import { router } from "@inertiajs/react";
import * as React from "react";

import { useTranslation } from "$app/utils/i18n";

import { Button } from "$app/components/Button";
import { Alert } from "$app/components/ui/Alert";

type BundleContentUpdatedStatusProps = {
  id: string;
};

export const BundleContentUpdatedStatus = ({ id }: BundleContentUpdatedStatusProps) => {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = React.useState(false);

  const updatePurchases = () => {
    router.post(
      Routes.update_purchases_content_bundle_content_path(id),
      {},
      {
        preserveScroll: true,
        onStart: () => setIsLoading(true),
        onFinish: () => setIsLoading(false),
      },
    );
  };

  return (
    <Alert role="status" variant="info">
      <div className="flex flex-col gap-4">
        <strong>{t("seller.bundles.content_outdated_title")}</strong>
        {t("seller.bundles.content_outdated_desc")}
        <Button color="primary" onClick={updatePurchases} disabled={isLoading}>
          {isLoading ? t("seller.bundles.updating") : t("seller.bundles.yes_update")}
        </Button>
      </div>
    </Alert>
  );
};
