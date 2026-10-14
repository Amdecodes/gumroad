import * as React from "react";

import { t } from "$app/utils/i18n";

import { Button } from "$app/components/Button";
import { useState, getErrors, isProcessing } from "$app/components/Checkout/payment";
import { Modal } from "$app/components/Modal";
import { Alert } from "$app/components/ui/Alert";
import { Fieldset, FieldsetTitle } from "$app/components/ui/Fieldset";
import { Input } from "$app/components/ui/Input";
import { Label } from "$app/components/ui/Label";
import { LinkButton } from "$app/components/ui/LinkButton";
import { Switch } from "$app/components/ui/Switch";
import { Textarea } from "$app/components/ui/Textarea";

export const GiftForm = ({ isMembership, className }: { isMembership: boolean; className?: string | undefined }) => {
  const giftEmailUID = React.useId();
  const giftNoteUID = React.useId();
  const [cancellingPresetGift, setCancellingPresetGift] = React.useState(false);

  const [state, dispatch] = useState();
  const { gift } = state;
  const hasError = getErrors(state).has("gift");
  // Toggling the gift option changes what gets charged (free trials are charged immediately
  // when gifted), which invalidates the locked FX quote — so like the tip and address fields,
  // these controls lock while a payment is in flight to keep the confirmed totals stable.
  const processing = isProcessing(state);

  return (
    <div className={`flex flex-col gap-4 ${className}`}>
      <Label className="flex w-full grow items-center gap-4">
        <Switch
          checked={!!gift}
          disabled={processing}
          onChange={(e) => {
            if (gift?.type === "anonymous") {
              e.preventDefault();
              setCancellingPresetGift(true);
            } else {
              dispatch({
                type: "set-value",
                gift: gift ? null : { type: "normal", email: "", note: "", hideGifter: false },
              });
            }
          }}
        />
        <h4>{t("checkout.give_as_gift")}</h4>
      </Label>

      {gift ? (
        <div className="flex w-full flex-col gap-4">
          {isMembership ? <Alert variant="info">{t("checkout.gift_membership_note")}</Alert> : null}
          {gift.type === "normal" ? (
            <Fieldset state={hasError ? "danger" : undefined}>
              <FieldsetTitle>
                <Label htmlFor={giftEmailUID}>{t("checkout.recipient_email")}</Label>
              </FieldsetTitle>
              <Input
                id={giftEmailUID}
                type="email"
                value={gift.email}
                disabled={processing}
                onChange={(evt) => dispatch({ type: "set-value", gift: { ...gift, email: evt.target.value } })}
                placeholder={t("checkout.recipient_email_placeholder")}
                aria-invalid={hasError}
              />
            </Fieldset>
          ) : (
            <Alert variant="info">
              {t("checkout.gift_email_hidden", { name: gift.name })}{" "}
              <LinkButton onClick={() => setCancellingPresetGift(true)}>{t("checkout.cancel_gift_option")}</LinkButton>
              <Modal
                open={cancellingPresetGift}
                onClose={() => setCancellingPresetGift(false)}
                footer={
                  <>
                    <Button onClick={() => setCancellingPresetGift(false)}>{t("actions.no_cancel")}</Button>
                    <Button
                      color="primary"
                      disabled={processing}
                      onClick={() => {
                        dispatch({ type: "set-value", gift: null });
                        setCancellingPresetGift(false);
                      }}
                    >
                      {t("actions.yes_reset")}
                    </Button>
                  </>
                }
                title={t("checkout.reset_gift_title")}
              >
                {t("checkout.reset_gift_message")}
              </Modal>
            </Alert>
          )}
          <Fieldset className="w-full">
            <FieldsetTitle>
              <Label htmlFor={giftNoteUID}>{t("checkout.message")}</Label>
            </FieldsetTitle>
            <Textarea
              id={giftNoteUID}
              value={gift.note}
              disabled={processing}
              onChange={(evt) => dispatch({ type: "set-value", gift: { ...gift, note: evt.target.value } })}
              placeholder={t("checkout.gift_message_placeholder")}
              className="w-full"
            />
          </Fieldset>
          <Label className="flex w-full grow items-center gap-4">
            <Switch
              checked={!!gift.hideGifter}
              disabled={processing}
              onChange={() => dispatch({ type: "set-value", gift: { ...gift, hideGifter: !gift.hideGifter } })}
            />
            {t("checkout.stay_anonymous")}
          </Label>
        </div>
      ) : null}
    </div>
  );
};
