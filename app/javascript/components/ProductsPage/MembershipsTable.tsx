import { router } from "@inertiajs/react";
import * as React from "react";

import { Membership, SortKey } from "$app/data/products";
import { classNames } from "$app/utils/classNames";
import { formatPriceCentsWithCurrencySymbol } from "$app/utils/currency";
import { t } from "$app/utils/i18n";

import { Pagination, PaginationProps } from "$app/components/Pagination";
import { Tab } from "$app/components/ProductsLayout";
import ActionsPopover from "$app/components/ProductsPage/ActionsPopover";
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
import { Sort, useSortingTableDriver } from "$app/components/useSortingTableDriver";

export const ProductsPageMembershipsTable = (props: {
  entries: Membership[];
  pagination: PaginationProps;
  selectedTab: Tab;
  query: string | null;
  sort?: Sort<SortKey> | null | undefined;
  setEnableArchiveTab: ((enable: boolean) => void) | undefined;
}) => {
  const [isLoading, setIsLoading] = React.useState(false);
  const tableRef = React.useRef<HTMLTableElement>(null);
  const userAgentInfo = useUserAgentInfo();
  const [sort, setSort] = React.useState<Sort<SortKey> | null>(props.sort ?? null);
  const memberships = props.entries;
  const pagination = props.pagination;

  const onSetSort = (newSort: Sort<SortKey> | null) => {
    router.reload({
      data: {
        memberships_sort_key: newSort?.key,
        memberships_sort_direction: newSort?.direction,
        memberships_page: undefined,
      },
      only: ["memberships_data", "has_products"],
      onBefore: () => setSort(newSort),
      onStart: () => setIsLoading(true),
      onFinish: () => setIsLoading(false),
    });
  };

  const thProps = useSortingTableDriver<SortKey>(sort, onSetSort);

  const loadMemberships = (page = 1) => {
    router.reload({
      data: {
        memberships_page: page,
        memberships_sort_key: sort?.key,
        memberships_sort_direction: sort?.direction,
        query: props.query || undefined,
      },
      only: ["memberships_data", "has_products"],
      onStart: () => setIsLoading(true),
      onFinish: () => {
        setIsLoading(false);
        tableRef.current?.scrollIntoView({ behavior: "smooth" });
      },
    });
  };

  const reloadMemberships = () => loadMemberships(pagination.page);

  if (!memberships.length) return null;

  return (
    <section className="flex flex-col gap-4">
      <Table ref={tableRef} aria-live="polite" className={classNames(isLoading && "pointer-events-none opacity-50")}>
        <TableCaption>{t("seller.products.memberships_caption")}</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead />
            <TableHead
              {...thProps("name")}
              title={t("seller.products.sort_by_name")}
              className="lg:relative lg:-left-20"
            >
              {t("seller.products.name")}
            </TableHead>
            <TableHead {...thProps("successful_sales_count")} title={t("seller.products.sort_by_members")}>
              {t("seller.products.members")}
            </TableHead>
            <TableHead {...thProps("revenue")} title={t("seller.products.sort_by_revenue")}>
              {t("seller.products.revenue")}
            </TableHead>
            <TableHead {...thProps("display_price_cents")} title={t("seller.products.sort_by_price")}>
              {t("seller.products.price")}
            </TableHead>
            <TableHead {...thProps("status")} title={t("seller.products.sort_by_status")}>
              {t("seller.products.status")}
            </TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>

        <TableBody>
          {memberships.map((membership) => (
            <TableRow key={membership.id}>
              <ProductIconCell
                href={membership.can_edit ? membership.edit_url : membership.url}
                thumbnail={membership.thumbnail?.url ?? null}
              />
              {/* The name cell is `relative` so StretchedLink can fill it. Before this, only the
                  bold name text was clickable, which is a small target — sellers reported that
                  clicking a row "does nothing" when they had in fact tapped the dead space beside
                  the name (gumroad-private#1469). Making the entire cell clickable is as far as we
                  can widen it without nesting links: Safari doesn't support `position: relative` on
                  <tr>, so the row itself can't be the link. */}
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

              <TableCell className="whitespace-nowrap">
                {membership.successful_sales_count.toLocaleString(userAgentInfo.locale)}

                {membership.remaining_for_sale_count ? (
                  <small className="block">
                    {t("seller.products.remaining", { count: membership.remaining_for_sale_count })}
                  </small>
                ) : null}
              </TableCell>

              <TableCell className="whitespace-nowrap">
                {formatPriceCentsWithCurrencySymbol("usd", membership.revenue, { symbolFormat: "short" })}

                <small className="block">
                  {membership.has_duration
                    ? t("seller.products.including_pending_payments", {
                        amount: formatPriceCentsWithCurrencySymbol("usd", membership.revenue_pending, {
                          symbolFormat: "short",
                        }),
                      })
                    : t("seller.products.monthly_recurring_revenue", {
                        amount: formatPriceCentsWithCurrencySymbol("usd", membership.monthly_recurring_revenue, {
                          symbolFormat: "short",
                        }),
                      })}
                </small>
              </TableCell>

              <TableCell className="whitespace-nowrap">{membership.price_formatted}</TableCell>

              <TableCell className="whitespace-nowrap">
                {(() => {
                  switch (membership.status) {
                    case "unpublished":
                      return <>{t("seller.products.status_unpublished")}</>;
                    case "preorder":
                      return <>{t("seller.products.status_preorder")}</>;
                    case "published":
                      return <>{t("seller.products.status_published")}</>;
                  }
                })()}
              </TableCell>
              {membership.can_duplicate || membership.can_destroy ? (
                <TableCell>
                  <ActionsPopover
                    product={membership}
                    onDuplicate={() => loadMemberships()}
                    onDelete={() => reloadMemberships()}
                    onArchive={() => {
                      props.setEnableArchiveTab?.(true);
                      reloadMemberships();
                    }}
                    onUnarchive={(hasRemainingArchivedProducts) => {
                      props.setEnableArchiveTab?.(hasRemainingArchivedProducts);
                      if (!hasRemainingArchivedProducts) router.get(Routes.products_path());
                      else reloadMemberships();
                    }}
                  />
                </TableCell>
              ) : null}
            </TableRow>
          ))}
        </TableBody>

        <TableFooter>
          <TableRow>
            <TableCell colSpan={2}>{t("seller.products.totals")}</TableCell>

            <TableCell label={t("seller.products.members")} className="whitespace-nowrap">
              {memberships
                .reduce((sum, membership) => sum + membership.successful_sales_count, 0)
                .toLocaleString(userAgentInfo.locale)}
            </TableCell>

            <TableCell colSpan={4} label={t("seller.products.revenue")} className="whitespace-nowrap">
              {formatPriceCentsWithCurrencySymbol(
                "usd",
                memberships.reduce((sum, membership) => sum + membership.revenue, 0),
                { symbolFormat: "short" },
              )}
            </TableCell>
          </TableRow>
        </TableFooter>
      </Table>

      {pagination.pages > 1 ? (
        <Pagination onChangePage={(page) => loadMemberships(page)} pagination={pagination} />
      ) : null}
    </section>
  );
};
