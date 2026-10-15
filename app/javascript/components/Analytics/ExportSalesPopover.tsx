import * as React from "react";

import { t } from "$app/utils/i18n";

import { Button } from "$app/components/Button";
import { NavigationButtonInertia } from "$app/components/NavigationButton";
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from "$app/components/Popover";

export const ExportSalesPopover = () => {
  const [open, setOpen] = React.useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor>
        <PopoverTrigger asChild>
          <Button>{t("seller.analytics.export_all_sales")}</Button>
        </PopoverTrigger>
      </PopoverAnchor>
      <PopoverContent>
        <div className="flex flex-col gap-4">
          <h3>{t("seller.analytics.export_all_sales")}</h3>
          <div>{t("seller.analytics.export_all_sales_description")}</div>
          <NavigationButtonInertia
            color="primary"
            href={Routes.export_purchases_path()}
            onSuccess={() => setOpen(false)}
          >
            {t("seller.analytics.export_button")}
          </NavigationButtonInertia>
        </div>
      </PopoverContent>
    </Popover>
  );
};
