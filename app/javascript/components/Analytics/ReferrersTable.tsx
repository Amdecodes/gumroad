import * as React from "react";

import { formatPriceCentsWithCurrencySymbol } from "$app/utils/currency";
import { t } from "$app/utils/i18n";

import { type AnalyticsReferrerTotals } from "$app/components/Analytics";
import { Button } from "$app/components/Button";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "$app/components/ui/Table";
import { useClientSortingTableDriver } from "$app/components/useSortingTableDriver";

const ROWS_PER_PAGE = 10;

export const ReferrersTable = ({ data }: { data: AnalyticsReferrerTotals }) => {
  const tableData = React.useMemo(
    () =>
      Object.entries(data).map(([referrer, { sales, views, totals }]) => ({
        referrer,
        sales,
        views,
        totals,
        conversion: Math.min(sales / views, 1),
      })),
    [data],
  );

  const { items, thProps } = useClientSortingTableDriver(tableData, {
    key: "totals",
    direction: "desc",
  });

  const [maxRowsShown, setMaxRowsShown] = React.useState(ROWS_PER_PAGE);

  React.useEffect(() => {
    setMaxRowsShown(ROWS_PER_PAGE);
  }, [data]);

  return (
    <section>
      <Table>
        <TableCaption>
          <a href="/help/article/74-the-analytics-dashboard#Referrers-WBsBP" target="_blank" rel="noreferrer">
            {t("seller.analytics.referrers_caption")}
          </a>
        </TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>{t("seller.analytics.source")}</TableHead>
            <TableHead {...thProps("views")}>{t("seller.analytics.views")}</TableHead>
            <TableHead {...thProps("sales")}>{t("seller.analytics.sales")}</TableHead>
            <TableHead {...thProps("conversion")}>{t("seller.analytics.conversion")}</TableHead>
            <TableHead {...thProps("totals")}>{t("seller.analytics.total")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.length ? (
            items.slice(0, maxRowsShown).map(({ referrer, sales, views, totals, conversion }) => (
              <TableRow key={referrer}>
                <TableCell>{referrer === "direct" ? t("seller.analytics.direct_email_im") : referrer}</TableCell>
                <TableCell>{views}</TableCell>
                <TableCell>{sales}</TableCell>
                <TableCell>{`${(conversion * 100).toFixed(1).replace(".0", "")}%`}</TableCell>
                <TableCell>
                  {formatPriceCentsWithCurrencySymbol("usd", totals, { symbolFormat: "short", noCentsIfWhole: true })}
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={5}>{t("seller.analytics.nothing_yet")}</TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      {items.length > maxRowsShown && (
        <Button onClick={() => setMaxRowsShown(maxRowsShown + ROWS_PER_PAGE)} className="mt-4 flex">
          {t("seller.analytics.show_more")}
        </Button>
      )}
    </section>
  );
};
