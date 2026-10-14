import { usePage } from "@inertiajs/react";
import * as React from "react";

import { t } from "$app/utils/i18n";

import { NavigationButton } from "$app/components/Button";
import { Card, CardContent } from "$app/components/ui/Card";

type Props = {
  seller_response_due_at_formatted: string | null;
  purchase_for_dispute_evidence_id: string;
};

export default function Success() {
  const { seller_response_due_at_formatted, purchase_for_dispute_evidence_id } = usePage<Props>().props;

  return (
    <Card className="mx-auto my-8 max-w-2xl">
      <CardContent asChild>
        <header>
          {t("disputes.title")}
          <h2 className="grow">{t("disputes.submit_additional_info")}</h2>
        </header>
      </CardContent>
      <CardContent>
        <p>{t("disputes.saved_success")}</p>
        <p>
          {seller_response_due_at_formatted !== null
            ? t("disputes.sent_at_deadline_date", { date: seller_response_due_at_formatted })
            : t("disputes.sent_at_deadline")}
        </p>
        <NavigationButton href={Routes.purchase_dispute_evidence_path(purchase_for_dispute_evidence_id)}>
          {t("disputes.add_to_response")}
        </NavigationButton>
      </CardContent>
    </Card>
  );
}

Success.publicLayout = true;
