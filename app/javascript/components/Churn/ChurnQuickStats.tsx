import * as React from "react";

import { formatPriceCentsWithCurrencySymbol } from "$app/utils/currency";
import { t } from "$app/utils/i18n";

import { Stats } from "$app/components/Stats";

export type ChurnSummary = {
  churnRate: number;
  churnedCustomers: number;
  revenueLostCents: number;
  previousPeriodChurnRate: number | null;
};

const ChurnQuickStats = ({ summary }: { summary: ChurnSummary }) => (
  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
    <Stats title={<>{t("seller.churn.churn_rate")}</>} value={`${summary.churnRate.toFixed(2)}%`} />
    <Stats
      title={<>{t("seller.churn.last_period_churn_rate")}</>}
      value={summary.previousPeriodChurnRate === null ? "—" : `${summary.previousPeriodChurnRate.toFixed(2)}%`}
    />
    <Stats title={<>{t("seller.churn.churned_users")}</>} value={summary.churnedCustomers.toLocaleString()} />
    <Stats
      title={<>{t("seller.churn.revenue_lost")}</>}
      value={formatPriceCentsWithCurrencySymbol("usd", summary.revenueLostCents, {
        symbolFormat: "short",
        noCentsIfWhole: true,
      })}
    />
  </div>
);

export default ChurnQuickStats;
