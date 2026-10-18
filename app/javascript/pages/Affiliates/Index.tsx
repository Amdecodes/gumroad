import { ArrowInDownSquareHalf, Pencil, Search, Trash } from "@boxicons/react";
import { Link, router, useForm, usePage } from "@inertiajs/react";
import cx from "classnames";
import { parseISO } from "date-fns";
import * as React from "react";

import { type Affiliate, type AffiliateRequest, type AffiliateStatistics, getStatistics } from "$app/data/affiliates";
import { useTranslate } from "$app/hooks/useTranslate";
import { formatPriceCentsWithCurrencySymbol } from "$app/utils/currency";
import { assertResponseError } from "$app/utils/request";

import { Button, buttonVariants } from "$app/components/Button";
import { CopyToClipboard } from "$app/components/CopyToClipboard";
import { LoadingSpinner } from "$app/components/LoadingSpinner";
import { useLoggedInUser } from "$app/components/LoggedInUser";
import { NavigationButtonInertia } from "$app/components/NavigationButton";
import { Pagination, PaginationProps } from "$app/components/Pagination";
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from "$app/components/Popover";
import { showAlert } from "$app/components/server-components/Alert";
import { Skeleton } from "$app/components/Skeleton";
import { Card, CardContent } from "$app/components/ui/Card";
import { Input } from "$app/components/ui/Input";
import { InputGroup } from "$app/components/ui/InputGroup";
import { PageHeader } from "$app/components/ui/PageHeader";
import { Placeholder, PlaceholderImage } from "$app/components/ui/Placeholder";
import { Sheet, SheetHeader } from "$app/components/ui/Sheet";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "$app/components/ui/Table";
import { Tab, Tabs } from "$app/components/ui/Tabs";
import { useDebouncedCallback } from "$app/components/useDebouncedCallback";
import { useLocalPagination } from "$app/components/useLocalPagination";
import { useUserAgentInfo } from "$app/components/UserAgent";
import useRouteLoading from "$app/components/useRouteLoading";
import { Sort, useClientSortingTableDriver, useSortingTableDriver } from "$app/components/useSortingTableDriver";
import { WithTooltip } from "$app/components/WithTooltip";

import placeholder from "$assets/images/placeholders/affiliated.webp";

type SortKey = "affiliate_user_name" | "products" | "fee_percent" | "volume_cents";

type Props = {
  affiliate_requests: AffiliateRequest[];
  affiliates: Affiliate[];
  pagination: PaginationProps;
  allow_approve_all_requests: boolean;
  affiliates_disabled_reason: string | null;
};

const AffiliatesNavigation = () => {
  const { t } = useTranslate();
  return (
    <Tabs>
      <Tab asChild isSelected>
        <Link href={Routes.affiliates_path()}>{t("seller.affiliates.affiliates_tab")}</Link>
      </Tab>
      <Tab asChild isSelected={false}>
        <Link href={Routes.onboarding_affiliates_path()}>{t("seller.affiliates.affiliate_signup_form_tab")}</Link>
      </Tab>
    </Tabs>
  );
};

const SearchBoxPopover = ({ initialQuery, onSearch }: { initialQuery: string; onSearch: (query: string) => void }) => {
  const { t } = useTranslate();
  const [searchBoxOpen, setSearchBoxOpen] = React.useState(false);
  const [inputValue, setInputValue] = React.useState(initialQuery);

  React.useEffect(() => {
    setInputValue(initialQuery);
    if (searchBoxOpen && initialQuery.length > 0) {
      setSearchBoxOpen(true);
    }
  }, [initialQuery]);

  const handleChange = (evt: React.ChangeEvent<HTMLInputElement>) => {
    const value = evt.target.value;
    setInputValue(value);
    onSearch(value);
  };

  return (
    <Popover open={searchBoxOpen} onOpenChange={setSearchBoxOpen}>
      <PopoverAnchor>
        <PopoverTrigger aria-label={t("seller.affiliates.toggle_search_aria")} asChild>
          <Button size="icon">
            <Search className="size-5" />
          </Button>
        </PopoverTrigger>
      </PopoverAnchor>
      <PopoverContent>
        <InputGroup>
          <Search className="size-5 text-muted" />
          <Input
            value={inputValue}
            type="text"
            placeholder={t("seller.affiliates.search_placeholder")}
            aria-label={t("seller.affiliates.search_placeholder")}
            onChange={handleChange}
          />
        </InputGroup>
      </PopoverContent>
    </Popover>
  );
};

const ApproveAllButton = () => {
  const { t } = useTranslate();
  const { post, processing } = useForm({});
  return (
    <Button
      color="primary"
      onClick={() => post(Routes.approve_all_affiliate_requests_path(), { preserveScroll: true })}
      disabled={processing}
    >
      {processing ? t("seller.affiliates.approving") : t("seller.affiliates.approve_all")}
    </Button>
  );
};

const AffiliateRequestsTable = ({
  affiliateRequests,
  allowApproveAll,
}: {
  affiliateRequests: AffiliateRequest[];
  allowApproveAll: boolean;
}) => {
  const { t } = useTranslate();
  const loggedInUser = useLoggedInUser();
  const userAgentInfo = useUserAgentInfo();
  const { items, thProps } = useClientSortingTableDriver(affiliateRequests, { key: "date", direction: "asc" });
  const { items: visibleItems, showMoreItems } = useLocalPagination(items, 20);
  const [processingId, setProcessingId] = React.useState<string | null>(null);

  const updateAffiliateRequest = (id: string, action: "approve" | "ignore") => {
    router.patch(
      Routes.affiliate_request_path(id),
      { affiliate_request: { action } },
      {
        preserveScroll: true,
        onStart: () => setProcessingId(id),
        onFinish: () => setProcessingId(null),
      },
    );
  };

  return (
    <>
      {visibleItems.length > 0 ? (
        <Table>
          <TableCaption>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              {t("seller.affiliates.requests_caption")}
              {allowApproveAll ? <ApproveAllButton /> : null}
            </div>
          </TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead {...thProps("name")}>{t("seller.affiliates.col_name")}</TableHead>
              <TableHead {...thProps("promotion")}>{t("seller.affiliates.col_promotion")}</TableHead>
              <TableHead {...thProps("date")}>{t("seller.affiliates.col_date")}</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>

          <TableBody>
            {visibleItems.map((affiliateRequest) => (
              <TableRow key={affiliateRequest.id}>
                <TableCell>
                  {affiliateRequest.name}
                  <small className="block text-muted">{affiliateRequest.email}</small>
                </TableCell>

                <TableCell>{affiliateRequest.promotion}</TableCell>

                <TableCell>{parseISO(affiliateRequest.date).toLocaleDateString(userAgentInfo.locale)}</TableCell>

                <TableCell>
                  <div className="flex flex-wrap gap-3 lg:justify-end">
                    <Button
                      disabled={!loggedInUser?.policies.direct_affiliate.update || processingId !== null}
                      onClick={() => updateAffiliateRequest(affiliateRequest.id, "ignore")}
                    >
                      {processingId === affiliateRequest.id
                        ? t("seller.affiliates.ignoring")
                        : t("seller.affiliates.ignore")}
                    </Button>

                    <WithTooltip
                      tip={affiliateRequest.state === "approved" ? t("seller.affiliates.approved_tooltip") : null}
                      position="bottom"
                    >
                      <Button
                        color="primary"
                        onClick={() => updateAffiliateRequest(affiliateRequest.id, "approve")}
                        disabled={
                          !loggedInUser?.policies.direct_affiliate.update ||
                          affiliateRequest.state === "approved" ||
                          processingId !== null
                        }
                      >
                        {affiliateRequest.state === "approved"
                          ? t("seller.affiliates.approved")
                          : processingId === affiliateRequest.id
                            ? t("seller.affiliates.approving")
                            : t("seller.affiliates.approve")}
                      </Button>
                    </WithTooltip>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <Placeholder>{t("seller.affiliates.no_requests_yet")}</Placeholder>
      )}

      {showMoreItems ? <Button onClick={showMoreItems}>{t("seller.affiliates.load_more")}</Button> : null}
    </>
  );
};

const formattedSalesVolumeAmount = (amountCents: number) =>
  formatPriceCentsWithCurrencySymbol("usd", amountCents, { symbolFormat: "short" });

export default function AffiliatesIndex() {
  const { t } = useTranslate();
  const props = usePage<Props>().props;
  const loggedInUser = useLoggedInUser();
  const isNavigating = useRouteLoading();

  const { affiliates, affiliate_requests, pagination, allow_approve_all_requests, affiliates_disabled_reason } = props;
  const [selectedAffiliate, setSelectedAffiliate] = React.useState<Affiliate | null>(null);

  const searchParams = new URLSearchParams(window.location.search);
  const searchQuery = searchParams.get("query") ?? "";

  const sortFromUrl = React.useMemo((): Sort<SortKey> | null => {
    const column = searchParams.get("column");
    const direction = searchParams.get("sort");
    const isSortKey = (value: string | null): value is SortKey =>
      value === "affiliate_user_name" || value === "products" || value === "fee_percent" || value === "volume_cents";
    const isDirection = (value: string | null): value is "asc" | "desc" => value === "asc" || value === "desc";
    if (isSortKey(column) && isDirection(direction)) {
      return { key: column, direction };
    }
    return null;
  }, [searchParams.get("column"), searchParams.get("sort")]);
  const [sort, setSort] = React.useState<Sort<SortKey> | null>(sortFromUrl);

  React.useEffect(() => {
    setSort(sortFromUrl);
  }, [sortFromUrl]);

  const onSearch = useDebouncedCallback((newQuery: string) => {
    const params = new URLSearchParams(window.location.search);
    if (newQuery.length > 0) {
      params.set("query", newQuery);
    } else {
      params.delete("query");
    }
    params.delete("page");
    const url = new URL(window.location.href);
    url.search = params.toString();
    router.get(url.toString());
  }, 500);

  const onChangePage = (newPage: number) => {
    const params = new URLSearchParams(window.location.search);
    params.set("page", newPage.toString());
    const url = new URL(window.location.href);
    url.search = params.toString();
    router.get(url.toString());
  };

  const onSetSort = (newSort: Sort<SortKey> | null) => {
    const params = new URLSearchParams(window.location.search);
    if (pagination.pages > 1) params.set("page", "1");
    if (newSort) {
      params.set("column", newSort.key);
      params.set("sort", newSort.direction);
    } else {
      params.delete("column");
      params.delete("sort");
    }
    setSort(newSort);
    const url = new URL(window.location.href);
    url.search = params.toString();
    router.get(url.toString());
  };
  const thProps = useSortingTableDriver<SortKey>(sort, onSetSort);

  const formatAffiliateBasisPoints = (basisPoints: number) =>
    (basisPoints / 100).toLocaleString([], { style: "percent" });

  const formattedFeePercentLabel = (affiliate: Affiliate) => {
    if (affiliate.apply_to_all_products) return formatAffiliateBasisPoints(affiliate.fee_percent);

    const productCommissions = affiliate.products.map((product) => product.fee_percent ?? 0);
    const minFeePercent = Math.min(...productCommissions);
    const maxFeePercent = Math.max(...productCommissions);
    return minFeePercent === maxFeePercent
      ? formatAffiliateBasisPoints(minFeePercent)
      : `${formatAffiliateBasisPoints(minFeePercent)} - ${formatAffiliateBasisPoints(maxFeePercent)}`;
  };

  const productName = (products: Affiliate["products"]) =>
    products.length === 1 ? (products[0]?.name ?? "") : t("seller.affiliates.n_products", { count: products.length });
  const productTooltipLabel = (products: Affiliate["products"]) =>
    products.map((product) => `${product.name} (${formatAffiliateBasisPoints(product.fee_percent ?? 0)})`).join(", ");

  const remove = (affiliateId: string) => {
    if (selectedAffiliate) setSelectedAffiliate(null);
    router.delete(Routes.affiliate_path(affiliateId));
  };

  const [affiliateStatistics, setAffiliateStatistics] = React.useState<Record<string, AffiliateStatistics>>({});
  const affiliateStatisticsRequests = React.useRef<Set<string>>(new Set());

  React.useEffect(() => {
    for (const { id } of affiliates) {
      if (affiliateStatisticsRequests.current.has(id)) continue;

      affiliateStatisticsRequests.current.add(id);
      getStatistics(id).then(
        (statistics) => setAffiliateStatistics((prev) => ({ ...prev, [id]: statistics })),
        (err: unknown) => {
          assertResponseError(err);
          showAlert(err instanceof Error ? err.message : String(err), "error");
          affiliateStatisticsRequests.current.delete(id);
        },
      );
    }
  }, [affiliates]);

  return (
    <div>
      <PageHeader
        title={t("seller.affiliates.title")}
        actions={
          <>
            <SearchBoxPopover onSearch={onSearch} initialQuery={searchQuery} />
            <WithTooltip position="bottom" tip={affiliates_disabled_reason}>
              <NavigationButtonInertia
                href={Routes.new_affiliate_path()}
                color="accent"
                disabled={!loggedInUser?.policies.direct_affiliate.create || affiliates_disabled_reason !== null}
              >
                {t("seller.affiliates.add_affiliate")}
              </NavigationButtonInertia>
            </WithTooltip>
          </>
        }
      >
        <AffiliatesNavigation />
      </PageHeader>
      <div className="p-4 lg:p-8" style={{ display: "grid", gap: "var(--spacer-7)" }}>
        {isNavigating && affiliates.length === 0 ? (
          <div style={{ justifySelf: "center" }}>
            <LoadingSpinner className="size-20" />
          </div>
        ) : (
          <>
            {!searchQuery && pagination.page === 1 ? (
              <AffiliateRequestsTable
                affiliateRequests={affiliate_requests}
                allowApproveAll={allow_approve_all_requests}
              />
            ) : null}
            {affiliates.length > 0 ? (
              <>
                <section className="flex flex-col gap-4">
                  <Table aria-live="polite" className={cx(isNavigating && "pointer-events-none opacity-50")}>
                    <TableCaption>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        {t("seller.affiliates.affiliates_tab")}
                        <div className="text-base">
                          <a
                            href={Routes.export_affiliates_path()}
                            className={buttonVariants({ size: "default", color: "primary" })}
                          >
                            <ArrowInDownSquareHalf aria-hidden="true" className="size-5" />
                            {t("seller.affiliates.export")}
                          </a>
                        </div>
                      </div>
                    </TableCaption>
                    <TableHeader>
                      <TableRow>
                        <TableHead {...thProps("affiliate_user_name")}>{t("seller.affiliates.col_name")}</TableHead>
                        <TableHead {...thProps("products")}>{t("seller.affiliates.col_products")}</TableHead>
                        <TableHead {...thProps("fee_percent")}>{t("seller.affiliates.col_commission")}</TableHead>
                        <TableHead {...thProps("volume_cents")}>{t("seller.affiliates.col_sales")}</TableHead>
                        <TableHead />
                      </TableRow>
                    </TableHeader>

                    <TableBody>
                      {affiliates.map((affiliate) => {
                        const enabledProducts = affiliate.products;
                        const statistics = affiliateStatistics[affiliate.id];

                        return (
                          <TableRow
                            key={affiliate.id}
                            selected={affiliate.id === selectedAffiliate?.id}
                            onClick={() => setSelectedAffiliate(affiliate)}
                          >
                            <TableCell>{affiliate.affiliate_user_name}</TableCell>
                            <TableCell>
                              <WithTooltip
                                tip={enabledProducts.length <= 1 ? null : productTooltipLabel(enabledProducts)}
                              >
                                <a href={affiliate.product_referral_url} onClick={(e) => e.stopPropagation()}>
                                  {productName(enabledProducts)}
                                </a>
                              </WithTooltip>
                            </TableCell>
                            <TableCell>{formattedFeePercentLabel(affiliate)}</TableCell>
                            <TableCell aria-busy={!statistics}>
                              {statistics ? (
                                formattedSalesVolumeAmount(statistics.total_volume_cents)
                              ) : (
                                <Skeleton className="w-16" />
                              )}
                            </TableCell>
                            <TableCell onClick={(e) => e.stopPropagation()}>
                              <div className="flex flex-wrap gap-3 lg:justify-end">
                                <CopyToClipboard
                                  tooltipPosition="bottom"
                                  copyTooltip={t("seller.affiliates.copy_link")}
                                  text={affiliate.product_referral_url}
                                >
                                  <Button>{t("seller.affiliates.copy_link")}</Button>
                                </CopyToClipboard>

                                <NavigationButtonInertia
                                  href={Routes.edit_affiliate_path(affiliate.id)}
                                  size="icon"
                                  aria-label={t("actions.edit")}
                                  disabled={!loggedInUser?.policies.direct_affiliate.update || isNavigating}
                                >
                                  <Pencil className="size-5" />
                                </NavigationButtonInertia>

                                <Button
                                  type="submit"
                                  size="icon"
                                  color="danger"
                                  onClick={() => remove(affiliate.id)}
                                  aria-label={t("actions.remove")}
                                  disabled={!loggedInUser?.policies.direct_affiliate.update || isNavigating}
                                >
                                  <Trash className="size-5" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                  {pagination.pages > 1 ? <Pagination onChangePage={onChangePage} pagination={pagination} /> : null}
                </section>
                {selectedAffiliate ? (
                  <AffiliateDetails
                    selectedAffiliate={selectedAffiliate}
                    statistics={affiliateStatistics[selectedAffiliate.id]}
                    onClose={() => setSelectedAffiliate(null)}
                    onRemove={remove}
                    isNavigating={isNavigating}
                  />
                ) : null}
              </>
            ) : (
              <Placeholder>
                <PlaceholderImage src={placeholder} />
                <h2>{t("seller.affiliates.no_affiliates_found")}</h2>
              </Placeholder>
            )}
          </>
        )}
      </div>
    </div>
  );
}

const AffiliateDetails = ({
  selectedAffiliate,
  statistics,
  onClose,
  onRemove,
  isNavigating,
}: {
  selectedAffiliate: Affiliate;
  statistics: AffiliateStatistics | undefined;
  onClose: () => void;
  onRemove: (id: string) => void;
  isNavigating: boolean;
}) => {
  const { t } = useTranslate();
  const loggedInUser = useLoggedInUser();

  return (
    <Sheet open onOpenChange={onClose}>
      <SheetHeader>{selectedAffiliate.affiliate_user_name}</SheetHeader>
      {selectedAffiliate.products.map((product) => {
        const productStatistics = statistics?.products[product.id];

        return (
          <Card asChild key={product.id}>
            <section>
              <CardContent asChild>
                <h3>{product.name}</h3>
              </CardContent>
              {statistics ? (
                <>
                  <CardContent>
                    <h5 className="grow font-bold">{t("seller.affiliates.col_revenue")}</h5>
                    {formattedSalesVolumeAmount(productStatistics?.volume_cents ?? 0)}
                  </CardContent>
                  <CardContent>
                    <h5 className="grow font-bold">{t("seller.affiliates.col_sales")}</h5>
                    {productStatistics?.sales_count ?? 0}
                  </CardContent>
                </>
              ) : null}
              <CardContent>
                <h5 className="grow font-bold">{t("seller.affiliates.col_commission")}</h5>
                {((product.fee_percent ?? 0) / 100).toLocaleString([], { style: "percent" })}
              </CardContent>
              <CardContent>
                <CopyToClipboard
                  tooltipPosition="bottom"
                  copyTooltip={t("seller.affiliates.copy_link")}
                  text={product.referral_url}
                >
                  <Button>{t("seller.affiliates.copy_link")}</Button>
                </CopyToClipboard>
              </CardContent>
            </section>
          </Card>
        );
      })}
      <section style={{ display: "grid", gap: "var(--spacer-4)", gridAutoFlow: "column", gridAutoColumns: "1fr" }}>
        <NavigationButtonInertia
          href={Routes.edit_affiliate_path(selectedAffiliate.id)}
          aria-label={t("actions.edit")}
          disabled={!loggedInUser?.policies.direct_affiliate.update || isNavigating}
        >
          {t("actions.edit")}
        </NavigationButtonInertia>
        <Button
          color="danger"
          aria-label={t("actions.remove")}
          onClick={() => onRemove(selectedAffiliate.id)}
          disabled={!loggedInUser?.policies.direct_affiliate.update || isNavigating}
        >
          {t("actions.remove")}
        </Button>
      </section>
    </Sheet>
  );
};
