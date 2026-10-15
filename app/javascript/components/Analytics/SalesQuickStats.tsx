import { Circle } from "@boxicons/react";
import * as React from "react";

import { formatPriceCentsWithCurrencySymbol } from "$app/utils/currency";
import { t } from "$app/utils/i18n";

import { type AnalyticsTotal } from "$app/components/Analytics";
import { Stats } from "$app/components/Stats";

export const SalesQuickStats = ({ total }: { total: AnalyticsTotal | undefined }) => (
  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
    <Stats
      title={
        <>
          <Circle pack="filled" className="size-5 text-foreground" />
          {t("seller.analytics.sales_stat")}
        </>
      }
      value={total?.sales.toLocaleString() ?? ""}
    />
    <Stats
      title={
        <>
          <Circle pack="filled" className="size-5 text-active-bg" />
          {t("seller.analytics.views_stat")}
        </>
      }
      value={total?.views.toLocaleString() ?? ""}
    />
    <Stats
      title={
        <>
          <Circle pack="filled" className="size-5 text-accent" />
          {t("seller.analytics.total_stat")}
        </>
      }
      value={
        total
          ? formatPriceCentsWithCurrencySymbol("usd", total.totals, {
              symbolFormat: "short",
              noCentsIfWhole: true,
            })
          : ""
      }
    />
  </div>
);
