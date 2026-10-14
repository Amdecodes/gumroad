import * as React from "react";

import { t } from "$app/utils/i18n";

import { NumberInput } from "$app/components/NumberInput";
import { ToggleSettingRow } from "$app/components/SettingRow";
import { Fieldset, FieldsetDescription } from "$app/components/ui/Fieldset";
import { Input } from "$app/components/ui/Input";
import { InputGroup } from "$app/components/ui/InputGroup";
import { Label } from "$app/components/ui/Label";

const DEFAULT_NUMBER_OF_INSTALLMENTS = 2;

export const InstallmentPlanEditor = ({
  totalAmountCents,
  isPWYW,
  allowInstallmentPayments,
  numberOfInstallments,
  onAllowInstallmentPaymentsChange,
  onNumberOfInstallmentsChange,
}: {
  totalAmountCents: number;
  isPWYW: boolean;
  allowInstallmentPayments: boolean;
  numberOfInstallments: number | null;
  onAllowInstallmentPaymentsChange: (value: boolean) => void;
  onNumberOfInstallmentsChange: (value: number) => void;
}) => {
  React.useEffect(() => {
    if ((totalAmountCents <= 0 || isPWYW) && allowInstallmentPayments) {
      onAllowInstallmentPaymentsChange(false);
    }
  }, [totalAmountCents, isPWYW]);

  React.useEffect(() => {
    if (allowInstallmentPayments && numberOfInstallments === null) {
      onNumberOfInstallmentsChange(DEFAULT_NUMBER_OF_INSTALLMENTS);
    }
  }, [allowInstallmentPayments]);

  const noteId = React.useId();

  return (
    <>
      <ToggleSettingRow
        disabled={totalAmountCents <= 0 || isPWYW}
        describedById={isPWYW ? noteId : undefined}
        value={allowInstallmentPayments}
        onChange={onAllowInstallmentPaymentsChange}
        label={t("seller.productEdit.allow_installments")}
        dropdown={
          <Fieldset>
            <NumberInput value={numberOfInstallments} onChange={(value) => onNumberOfInstallmentsChange(value || 0)}>
              {(props) => (
                <InputGroup>
                  <Input
                    {...props}
                    type="number"
                    min={2}
                    aria-label={t("seller.productEdit.installments_number_label")}
                  />
                  <Label>{t("seller.productEdit.equal_monthly_payments")}</Label>
                </InputGroup>
              )}
            </NumberInput>
          </Fieldset>
        }
      />
      {isPWYW ? (
        <FieldsetDescription id={noteId}>{t("seller.productEdit.installments_pwyw_disabled")}</FieldsetDescription>
      ) : null}
    </>
  );
};
