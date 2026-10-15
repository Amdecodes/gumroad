import * as React from "react";
import typia from "typia";

import { useTranslate } from "$app/hooks/useTranslate";
import { formatDate } from "$app/utils/date";
import { asyncVoid } from "$app/utils/promise";
import { assertResponseError, request, ResponseError } from "$app/utils/request";

import { Button } from "$app/components/Button";
import { showAlert } from "$app/components/server-components/Alert";
import { Fieldset, FieldsetDescription, FieldsetTitle } from "$app/components/ui/Fieldset";
import { FormSection } from "$app/components/ui/FormSection";
import { Input } from "$app/components/ui/Input";
import { InputGroup } from "$app/components/ui/InputGroup";
import { Label } from "$app/components/ui/Label";
import { Pill } from "$app/components/ui/Pill";
import { Row, RowActions, RowContent, Rows } from "$app/components/ui/Rows";
import { WithTooltip } from "$app/components/WithTooltip";

export type PingDelivery = {
  id: number;
  resource_name: string;
  sale_id: string | null;
  subscription_id: number | null;
  post_url: string;
  attempt: number;
  outcome: string;
  succeeded: boolean;
  created_at: string;
};

const useResourceLabels = (): Record<string, string> => {
  const { t } = useTranslate();
  return React.useMemo(
    () => ({
      sale: t("seller.settings.advanced.res_sale"),
      refund: t("seller.settings.advanced.res_refund"),
      dispute: t("seller.settings.advanced.res_dispute"),
      dispute_won: t("seller.settings.advanced.res_dispute_won"),
      cancellation: t("seller.settings.advanced.res_cancellation"),
      subscription_ended: t("seller.settings.advanced.res_subscription_ended"),
      subscription_restarted: t("seller.settings.advanced.res_subscription_restarted"),
      subscription_updated: t("seller.settings.advanced.res_subscription_updated"),
    }),
    [t],
  );
};

const RecentDeliveries = ({ deliveries }: { deliveries: PingDelivery[] }) => {
  const { t } = useTranslate();
  const resourceLabels = useResourceLabels();

  const describeEvent = (delivery: PingDelivery) => {
    const label = resourceLabels[delivery.resource_name] ?? delivery.resource_name;
    if (!delivery.sale_id) return label;
    const reference = t("seller.settings.advanced.sale_ref", { id: delivery.sale_id });
    // Prefixing a sale row with its own label would read "Sale · Sale #123".
    return delivery.resource_name === "sale" ? reference : `${label} · ${reference}`;
  };

  const describeDelivery = (delivery: PingDelivery) => {
    const status = delivery.succeeded
      ? t("seller.settings.advanced.delivered")
      : t("seller.settings.advanced.not_delivered");
    const attempt =
      delivery.attempt > 1 ? ` ${t("seller.settings.advanced.attempt_n", { attempt: delivery.attempt })}` : "";
    return `${status} — ${delivery.outcome}${attempt}`;
  };

  if (deliveries.length === 0) {
    return <FieldsetDescription>{t("seller.settings.advanced.no_pings_sent_yet")}</FieldsetDescription>;
  }

  return (
    <Rows role="list">
      {deliveries.map((delivery) => (
        <Row key={delivery.id} role="listitem">
          <RowContent>
            <div className="flex flex-col">
              <h4>{describeEvent(delivery)}</h4>
              <span className="break-all text-muted">{delivery.post_url}</span>
              <span className={delivery.succeeded ? "text-muted" : "text-red"}>{describeDelivery(delivery)}</span>
            </div>
          </RowContent>
          <RowActions>{formatDate(new Date(delivery.created_at))}</RowActions>
        </Row>
      ))}
    </Rows>
  );
};

const NotificationEndpointSection = ({
  pingEndpoint,
  setPingEndpoint,
  userId,
  recentDeliveries,
}: {
  pingEndpoint: string;
  setPingEndpoint: (val: string) => void;
  userId: string;
  recentDeliveries: PingDelivery[];
}) => {
  const { t } = useTranslate();
  const [isSendingPing, setIsSendingPing] = React.useState(false);
  const uid = React.useId();

  const sendTestPing = asyncVoid(async () => {
    if (pingEndpoint.trim().length === 0) {
      showAlert(t("seller.settings.advanced.provide_url_error"), "error");
      return;
    }

    setIsSendingPing(true);
    try {
      const response = await request({
        url: Routes.test_pings_path(),
        method: "POST",
        accept: "json",
        data: { url: pingEndpoint.trim() },
      });
      const responseData = typia.assert<{ success: true; message: string } | { success: false; error_message: string }>(
        await response.json(),
      );
      if (!responseData.success) throw new ResponseError(responseData.error_message);
      showAlert(responseData.message, "success");
    } catch (e) {
      assertResponseError(e);
      showAlert(e.message, "error");
    }
    setIsSendingPing(false);
  });

  return (
    <FormSection
      header={
        <>
          <h2>{t("seller.settings.advanced.ping")}</h2>
          <a href={Routes.ping_path()} target="_blank" rel="noreferrer">
            {t("actions.learn_more")}
          </a>
        </>
      }
    >
      <Fieldset>
        <FieldsetTitle>
          <Label htmlFor={uid}>{t("seller.settings.advanced.ping_endpoint")}</Label>
        </FieldsetTitle>
        <InputGroup>
          <Input type="url" id={uid} value={pingEndpoint} onChange={(e) => setPingEndpoint(e.target.value)} />
          <WithTooltip tip={isSendingPing ? null : t("seller.settings.advanced.send_test_ping_tip")}>
            <Pill asChild>
              <Button className="rounded-full! px-3! py-2!" onClick={sendTestPing} disabled={isSendingPing}>
                {isSendingPing
                  ? t("seller.settings.advanced.sending_test_ping")
                  : t("seller.settings.advanced.send_test_ping_to_url")}
              </Button>
            </Pill>
          </WithTooltip>
        </InputGroup>
        <FieldsetDescription>{t("seller.settings.advanced.seller_id_note", { userId })}</FieldsetDescription>
      </Fieldset>
      <Fieldset>
        <FieldsetTitle>
          <Label>{t("seller.settings.advanced.recent_ping_deliveries")}</Label>
        </FieldsetTitle>
        <RecentDeliveries deliveries={recentDeliveries} />
      </Fieldset>
    </FormSection>
  );
};

export default NotificationEndpointSection;
