import * as React from "react";

import { sendSubscribersReport } from "$app/data/audience";
import { t } from "$app/utils/i18n";
import { assertResponseError } from "$app/utils/request";

import { Button } from "$app/components/Button";
import { LoadingSpinner } from "$app/components/LoadingSpinner";
import { PopoverClose } from "$app/components/Popover";
import { showAlert } from "$app/components/server-components/Alert";
import { Checkbox } from "$app/components/ui/Checkbox";
import { Label } from "$app/components/ui/Label";

export const ExportSubscribersPopover = () => {
  const [loading, setLoading] = React.useState(false);
  const [followers, setFollowers] = React.useState(true);
  const [customers, setCustomers] = React.useState(false);
  const [affiliates, setAffiliates] = React.useState(false);

  const handleDownload = async () => {
    try {
      setLoading(true);
      await sendSubscribersReport({
        options: {
          followers,
          customers,
          affiliates,
        },
      });

      showAlert(t("seller.audience.export_preparing"), "success");
    } catch (error) {
      assertResponseError(error);
      showAlert(t("common.something_went_wrong"), "error");
    }

    setLoading(false);
  };

  const noOptionSelected = !followers && !customers && !affiliates;
  const allSelected = followers && customers && affiliates;

  const selectAll = () => {
    setFollowers(!allSelected);
    setCustomers(!allSelected);
    setAffiliates(!allSelected);
  };

  return (
    <div>
      <h4 className="mb-1 font-semibold">{t("seller.audience.export_subscribers_title")}</h4>
      <p className="mb-4">{t("seller.audience.export_subscribers_desc")}</p>

      <div className="mb-4 flex flex-col gap-2">
        <Label className="font-medium">
          <Checkbox checked={allSelected} onChange={selectAll} />
          {t("seller.audience.all_subscribers")}
        </Label>
        <Label>
          <Checkbox
            checked={followers}
            onChange={(evt) => {
              setFollowers(evt.target.checked);
            }}
          />
          {t("seller.audience.followers")}
        </Label>
        <Label>
          <Checkbox
            checked={customers}
            onChange={(evt) => {
              setCustomers(evt.target.checked);
            }}
          />
          {t("seller.audience.customers")}
        </Label>
        <Label>
          <Checkbox
            checked={affiliates}
            onChange={(evt) => {
              setAffiliates(evt.target.checked);
            }}
          />
          {t("seller.audience.affiliates")}
        </Label>
      </div>
      <div className="grid">
        <PopoverClose asChild>
          <Button disabled={noOptionSelected || loading} onClick={() => void handleDownload()}>
            {loading ? <LoadingSpinner color="grey" /> : t("actions.download")}
          </Button>
        </PopoverClose>
      </div>
    </div>
  );
};
