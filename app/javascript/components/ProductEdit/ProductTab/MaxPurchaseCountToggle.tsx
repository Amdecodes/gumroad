import * as React from "react";

import { t } from "$app/utils/i18n";

import { Dropdown } from "$app/components/Dropdown";
import { NumberInput } from "$app/components/NumberInput";
import { Details, DetailsToggle } from "$app/components/ui/Details";
import { Fieldset } from "$app/components/ui/Fieldset";
import { Input } from "$app/components/ui/Input";
import { Label } from "$app/components/ui/Label";
import { Switch } from "$app/components/ui/Switch";
import { WithTooltip } from "$app/components/WithTooltip";

export const MaxPurchaseCountToggle = ({
  maxPurchaseCount,
  setMaxPurchaseCount,
}: {
  maxPurchaseCount: number | null;
  setMaxPurchaseCount: (maxPurchaseCount: number | null) => void;
}) => {
  const [count, setCount] = React.useState<number | null>(maxPurchaseCount);
  const [isEnabled, setIsEnabled] = React.useState(maxPurchaseCount != null);

  React.useEffect(() => setMaxPurchaseCount(isEnabled ? count : null), [count, isEnabled]);

  const uid = React.useId();

  return (
    <Details open={isEnabled}>
      <DetailsToggle chevronPosition="none" className="mb-0">
        <Switch
          checked={isEnabled}
          onChange={(e) => setIsEnabled(e.target.checked)}
          label={t("seller.productEdit.limit_sales")}
        />
      </DetailsToggle>
      <Dropdown>
        <Fieldset>
          <Label htmlFor={`${uid}-max-purchase-count`}>{t("seller.productEdit.max_number_of_purchases")}</Label>
          <WithTooltip tip={t("seller.productEdit.total_sales_tooltip")}>
            <NumberInput value={count} onChange={setCount}>
              {(props) => <Input id={`${uid}-max-purchase-count`} placeholder="∞" {...props} />}
            </NumberInput>
          </WithTooltip>
        </Fieldset>
      </Dropdown>
    </Details>
  );
};
