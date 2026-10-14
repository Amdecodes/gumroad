import * as React from "react";

import { t } from "$app/utils/i18n";

import { useProductEditContext } from "$app/components/ProductEdit/state";
import { ToggleSettingRow } from "$app/components/SettingRow";
import { TypeSafeOptionSelect } from "$app/components/TypeSafeOptionSelect";
import { Fieldset, FieldsetTitle } from "$app/components/ui/Fieldset";
import { Label } from "$app/components/ui/Label";

const PERMITTED_DURATIONS = ["week", "month"] as const;
const DEFAULT_DURATION = 1;
const DEFAULT_DURATION_UNIT = "week";

export const FreeTrialSelector = () => {
  const uid = React.useId();

  const { product, updateProduct } = useProductEditContext();

  return (
    <ToggleSettingRow
      value={product.free_trial_enabled}
      onChange={(enabled) =>
        updateProduct({
          free_trial_enabled: enabled,
          free_trial_duration_amount: enabled ? DEFAULT_DURATION : null,
          free_trial_duration_unit: enabled ? DEFAULT_DURATION_UNIT : null,
        })
      }
      label={t("seller.productEdit.offer_free_trial")}
      dropdown={
        <Fieldset>
          <FieldsetTitle>
            <Label htmlFor={uid}>{t("seller.productEdit.charge_members_after")}</Label>
          </FieldsetTitle>
          <TypeSafeOptionSelect
            id={uid}
            value={product.free_trial_duration_unit || DEFAULT_DURATION_UNIT}
            onChange={(duration) =>
              updateProduct({ free_trial_duration_unit: duration, free_trial_duration_amount: 1 })
            }
            options={PERMITTED_DURATIONS.map((option) => ({
              id: option,
              label: option === "month" ? t("seller.productEdit.one_month") : t("seller.productEdit.one_week"),
            }))}
          />
        </Fieldset>
      }
    />
  );
};
