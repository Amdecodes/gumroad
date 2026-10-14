import * as React from "react";

import { CustomButtonTextOption } from "$app/parsers/product";
import { t } from "$app/utils/i18n";

import { getCtaName } from "$app/components/Product/CtaButton";
import { TypeSafeOptionSelect } from "$app/components/TypeSafeOptionSelect";
import { Fieldset, FieldsetDescription } from "$app/components/ui/Fieldset";
import { Label } from "$app/components/ui/Label";

export const CustomButtonTextOptionInput = <T extends CustomButtonTextOption>({
  value,
  onChange,
  options,
}: {
  value: T | null;
  onChange: (value: T) => void;
  options: readonly T[];
}) => {
  const uid = React.useId();

  if (!options[0]) return null;

  return (
    <Fieldset>
      <Label htmlFor={uid}>{t("seller.productEdit.call_to_action")}</Label>
      <TypeSafeOptionSelect
        id={uid}
        aria-describedby={`${uid}-description`}
        value={value ?? options[0]}
        onChange={onChange}
        options={options.map((option) => ({ id: option, label: getCtaName(option) }))}
      />
      <FieldsetDescription id={`${uid}-description`}>{t("seller.productEdit.call_to_action_desc")}</FieldsetDescription>
    </Fieldset>
  );
};
