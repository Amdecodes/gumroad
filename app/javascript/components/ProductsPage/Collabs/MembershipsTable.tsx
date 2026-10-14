import { router } from "@inertiajs/react";
import * as React from "react";

import { Membership } from "$app/data/collabs";
import { classNames } from "$app/utils/classNames";
import { formatPriceCentsWithCurrencySymbol } from "$app/utils/currency";
import { t } from "$app/utils/i18n";

import { Pagination, PaginationProps } from "$app/components/Pagination";
import { ProductIconCell } from "$app/components/ProductsPage/ProductIconCell";
import { StretchedLink } from "$app/components/ui/StretchedLink";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "$app/components/ui/Table";
import { useUserAgentInfo } from "$app/components/UserAgent";
import { useClientSortingTableDriver } from "$app/components/useSortingTableDriver";

export const CollabsMembershipsTable = (props: { entries: Membership[]; pagination: PaginationProps }) => {
  const [isLoading, setIsLoading] = React.useState(false);
  const tableRef = React.useRef<HTMLTableElement>(null);
  const { locale } = useUserAgentInfo();
  const { items: memberships, thProps } = useClientSortingTableDriver(props.entries);

  const handlePageChange = (page: number) => {
    router.reload({
      data: { memberships_page: page },
      only: ["memberships_data"],
      onStart: () => setIsLoading(true),
      onFinish: () => {
        setIsLoading(false);
        tableRef.current?.scrollIntoView({ behavior: "smooth" });
      },
    });
  };

  return (
    <section className="flex flex-col gap-4">
      <Table ref={tableRef} aria-live="polite" className={classNames(isLoading && "pointer-events-none opacity-50")}>
        <TableCaption>{t("seller.products.memberships_caption")}</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead />
            <TableHead {...thProps("name")} title={t("seller.products.sort_by_name")}>
              {t("seller.products.name")}
            </TableHead>

            <TableHead {...thProps("display_price_cents")} title={t("seller.products.sort_by_price")}>
              {t("seller.products.price")}
            </TableHead>
            <TableHead {...thProps("cut")} title={t("seller.products.sort_by_cut")}>
              {t("seller.products.cut")}
            </TableHead>
            <TableHead {...thProps("successful_sales_count")} title={t("seller.products.sort_by_members")}>
              {t("seller.products.members")}
            </TableHead>
            <TableHead {...thProps("revenue")} title={t("seller.products.sort_by_revenue")}>
              {t("seller.products.revenue")}
            </TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {memberships.map((membership) => (
            <TableRow key={membership.id}>
              <ProductIconCell
                href={membership.can_edit ? membership.edit_url : membership.url}
                thumbnail={membership.thumbnail?.url ?? null}
              />

              {/* The name cell is `relative` so StretchedLink can fill it, as in
                  ProductsPage/ProductsTable.tsx. Only the bold name text used to be clickable,
                  which is a small target, and sellers reported that clicking a row "does nothing"
                  when they had in fact tapped the dead space beside the name (gumroad-private#1469).
                  Safari doesn't support `position: relative` on <tr>, so the row itself can't be
                  the link. */}
              <TableCell hideLabel className="relative">
                <StretchedLink href={membership.can_edit ? membership.edit_url : membership.url}>
                  {/* dir="auto" lets RTL product names render right-to-left (gumroad-private#1259). */}
                  <h4 className="relative font-bold" dir="auto">
                    {membership.name}
                  </h4>
                </StretchedLink>
                <a
                  href={membership.url}
                  title={membership.url}
                  target="_blank"
                  rel="noreferrer"
                  className="relative z-1"
                >
                  <small className="block">{membership.url_without_protocol}</small>
                </a>
              </TableCell>

              <TableCell>{membership.price_formatted}</TableCell>

              <TableCell>{membership.cut}%</TableCell>

              <TableCell>
                {membership.successful_sales_count.toLocaleString(locale)}

                {membership.remaining_for_sale_count ? (
                  <small className="block">
                    {t("seller.products.remaining", { count: membership.remaining_for_sale_count })}
                  </small>
                ) : null}
              </TableCell>

              <TableCell>
                {formatPriceCentsWithCurrencySymbol("usd", membership.revenue, { symbolFormat: "short" })}

                <small className="block">
                  {membership.has_duration
                    ? t("seller.products.including_pending_payments", {
                        amount: formatPriceCentsWithCurrencySymbol(
                          "usd",
                          membership.revenue_pending * (membership.cut / 100.0),
                          {
                            symbolFormat: "short",
                          },
                        ),
                      })
                    : t("seller.products.monthly_recurring_revenue", {
                        amount: formatPriceCentsWithCurrencySymbol(
                          "usd",
                          membership.monthly_recurring_revenue * (membership.cut / 100.0),
                          {
                            symbolFormat: "short",
                          },
                        ),
                      })}
                </small>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>

        <TableFooter>
          <TableRow>
            <TableCell colSpan={4}>{t("seller.products.totals")}</TableCell>

            <TableCell label={t("seller.products.members")}>
              {memberships
                .reduce((sum, membership) => sum + membership.successful_sales_count, 0)
                .toLocaleString(locale)}
            </TableCell>

            <TableCell label={t("seller.products.revenue")}>
              {formatPriceCentsWithCurrencySymbol(
                "usd",
                memberships.reduce((sum, membership) => sum + membership.revenue, 0),
                { symbolFormat: "short" },
              )}
            </TableCell>
          </TableRow>
        </TableFooter>
      </Table>

      {props.pagination.pages > 1 ? <Pagination onChangePage={handlePageChange} pagination={props.pagination} /> : null}
    </section>
  );
};
