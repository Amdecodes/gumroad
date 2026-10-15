import { Copy, DotsHorizontalRounded, Link as LinkIcon, Pencil, Trash } from "@boxicons/react";
import { Link, router, usePage } from "@inertiajs/react";
import * as React from "react";

import { useTranslate } from "$app/hooks/useTranslate";
import { SavedUtmLink, SortKey, UtmLinkStats, UtmLinksStats } from "$app/types/utm_link";
import { classNames } from "$app/utils/classNames";

import { AnalyticsLayout } from "$app/components/Analytics/AnalyticsLayout";
import { Button } from "$app/components/Button";
import { CopyToClipboard } from "$app/components/CopyToClipboard";
import { LoadingSpinner } from "$app/components/LoadingSpinner";
import { Modal } from "$app/components/Modal";
import { NavigationButtonInertia } from "$app/components/NavigationButton";
import { Pagination, PaginationProps } from "$app/components/Pagination";
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from "$app/components/Popover";
import { Search } from "$app/components/Search";
import { showAlert } from "$app/components/server-components/Alert";
import { Skeleton } from "$app/components/Skeleton";
import { Card, CardContent } from "$app/components/ui/Card";
import { Menu, MenuItem } from "$app/components/ui/Menu";
import { Placeholder, PlaceholderImage } from "$app/components/ui/Placeholder";
import { Sheet, SheetHeader } from "$app/components/ui/Sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "$app/components/ui/Table";
import { useDebouncedCallback } from "$app/components/useDebouncedCallback";
import { useUserAgentInfo } from "$app/components/UserAgent";
import useRouteLoading from "$app/components/useRouteLoading";
import { Sort, useSortingTableDriver } from "$app/components/useSortingTableDriver";
import { WithTooltip } from "$app/components/WithTooltip";

import noLinksYetPlaceholder from "$assets/images/placeholders/utm_links_empty.png";
import noLinksFoundPlaceholder from "$assets/images/placeholders/utm_links_not_found.png";

type UtmLinksIndexProps = {
  utm_links: SavedUtmLink[];
  pagination: PaginationProps;
  query: string | null;
  sort: Sort<SortKey> | null;
  utm_links_stats: UtmLinksStats;
};

const truncateText = (text: string, maxLength: number) => {
  const truncated = text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
  return {
    isTruncated: text.length > maxLength,
    truncated,
    original: text,
  };
};

const fixedDecimalPointNumber = (value: number) => +value.toFixed(2);

const utmLinkWithStats = (utmLink: SavedUtmLink, stats?: UtmLinkStats) => {
  if (!stats) return utmLink;
  const link = { ...utmLink };
  link.sales_count ??= stats.sales_count;
  link.revenue_cents ??= stats.revenue_cents;
  link.conversion_rate ??= stats.conversion_rate;
  return link;
};

export const extractSortParam = (searchParams: URLSearchParams): Sort<SortKey> | null => {
  const column = searchParams.get("key");
  switch (column) {
    case "link":
    case "date":
    case "source":
    case "medium":
    case "campaign":
    case "clicks":
    case "sales_count":
    case "revenue_cents":
    case "conversion_rate":
      return {
        key: column,
        direction: searchParams.get("direction") === "desc" ? "desc" : "asc",
      };
    default:
      return null;
  }
};

export default function UtmLinksIndex() {
  const { t } = useTranslate();
  const {
    utm_links: utmLinks,
    pagination,
    query: initialQuery,
    sort: initialSort,
    utm_links_stats: utmLinksStats,
  } = usePage<UtmLinksIndexProps>().props;
  const isNavigating = useRouteLoading();

  const utmLinksWithStats = utmLinks.map((utmLink) => utmLinkWithStats(utmLink, utmLinksStats[utmLink.id]));
  const [selectedUtmLink, setSelectedUtmLink] = React.useState<SavedUtmLink | null>(null);
  const [sort, setSort] = React.useState<Sort<SortKey> | null>(() => initialSort || { key: "date", direction: "desc" });
  const [deletingUtmLink, setDeletingUtmLink] = React.useState<{
    id: string;
    title: string;
    state: "delete-confirmation" | "deleting";
  } | null>(null);

  const fetchUtmLinksStats = useDebouncedCallback((ids: string[]) => {
    router.reload({
      data: { ids },
      only: ["utm_links_stats"],
      preserveUrl: true,
    });
  }, 500);

  React.useEffect(() => {
    if (utmLinks.length === 0) return;
    const sortKey = sort?.key;
    if (sortKey === "sales_count" || sortKey === "revenue_cents" || sortKey === "conversion_rate") return;
    const ids = utmLinks.flatMap((link) =>
      utmLinkWithStats(link, utmLinksStats[link.id]).sales_count === null ? [link.id] : [],
    );
    if (ids.length === 0) return;

    fetchUtmLinksStats(ids);
  }, [utmLinks, sort]);

  const query = initialQuery ?? "";

  const onChangePage = (newPage: number) => {
    fetchUtmLinksStats.cancel();
    router.reload({ data: { page: newPage } });
  };

  const onSetSort = (newSort: Sort<SortKey> | null) => {
    fetchUtmLinksStats.cancel();
    setSort(newSort);
    router.reload({
      data: {
        key: newSort?.key,
        direction: newSort?.direction,
        page: undefined,
      },
      only: ["utm_links", "pagination", "sort"],
    });
  };

  const thProps = useSortingTableDriver<SortKey>(sort, onSetSort);

  const onSearch = useDebouncedCallback((newQuery: string) => {
    if (query === newQuery) return;

    router.reload({
      data: { query: newQuery.length > 0 ? newQuery : undefined, page: undefined },
      only: ["utm_links", "pagination", "query"],
    });
  }, 500);

  const handleDelete = (id: string) => {
    router.delete(Routes.dashboard_utm_link_path(id), {
      preserveScroll: true,
      onStart: () => setDeletingUtmLink((prev) => prev && { ...prev, state: "deleting" }),
      onSuccess: () => setSelectedUtmLink(null),
      onError: () => showAlert(t("seller.utm_links.failed_to_delete_link"), "error"),
      onFinish: () => setDeletingUtmLink(null),
    });
  };

  return (
    <AnalyticsLayout
      selectedTab="utm_links"
      actions={
        <>
          <Search value={query} onSearch={onSearch} />
          <NavigationButtonInertia href={Routes.new_dashboard_utm_link_path()} color="accent">
            {t("seller.utm_links.create_link")}
          </NavigationButtonInertia>
        </>
      }
    >
      {isNavigating && utmLinks.length === 0 ? (
        <div style={{ justifySelf: "center" }}>
          <LoadingSpinner className="size-20" />
        </div>
      ) : utmLinks.length > 0 ? (
        <section className="flex flex-col gap-4 p-4 md:p-8">
          <Table aria-live="polite" className={classNames(isNavigating && "pointer-events-none opacity-50")}>
            <TableHeader>
              <TableRow>
                <TableHead {...thProps("link")} style={{ width: "30%" }}>
                  {t("seller.utm_links.col_link")}
                </TableHead>
                <TableHead {...thProps("source")}>{t("seller.utm_links.col_source")}</TableHead>
                <TableHead {...thProps("medium")}>{t("seller.utm_links.col_medium")}</TableHead>
                <TableHead {...thProps("campaign")}>{t("seller.utm_links.col_campaign")}</TableHead>
                <TableHead {...thProps("clicks")}>{t("seller.utm_links.col_clicks")}</TableHead>
                <TableHead {...thProps("revenue_cents")}>{t("seller.utm_links.col_revenue")}</TableHead>
                <TableHead {...thProps("conversion_rate")}>{t("seller.utm_links.col_conversion")}</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {utmLinksWithStats.map((link) => (
                <TableRow
                  key={link.id}
                  selected={link.id === selectedUtmLink?.id}
                  onClick={() => setSelectedUtmLink(link)}
                >
                  <TableCell>
                    <div>
                      <h4>
                        <TruncatedTextWithTooltip text={link.title} maxLength={35} />
                      </h4>
                      <small className="block">
                        <a href={link.destination_option?.url} target="_blank" rel="noopener noreferrer">
                          <TruncatedTextWithTooltip text={link.destination_option?.label ?? ""} maxLength={35} />
                        </a>
                      </small>
                    </div>
                  </TableCell>
                  <TableCell>
                    <TruncatedTextWithTooltip text={link.source} maxLength={16} />
                  </TableCell>
                  <TableCell>
                    <TruncatedTextWithTooltip text={link.medium} maxLength={16} />
                  </TableCell>
                  <TableCell>
                    <TruncatedTextWithTooltip text={link.campaign} maxLength={16} />
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{link.clicks}</TableCell>
                  <TableCell aria-busy={link.revenue_cents === null} className="whitespace-nowrap">
                    {link.revenue_cents !== null ? (
                      `$${fixedDecimalPointNumber(link.revenue_cents / 100)}`
                    ) : (
                      <Skeleton className="w-16" />
                    )}
                  </TableCell>
                  <TableCell aria-busy={link.conversion_rate === null} className="whitespace-nowrap">
                    {link.conversion_rate !== null ? (
                      `${fixedDecimalPointNumber(link.conversion_rate * 100)}%`
                    ) : (
                      <Skeleton className="w-16" />
                    )}
                  </TableCell>
                  <TableCell>
                    <UtmLinkActions
                      link={link}
                      onDelete={() =>
                        setDeletingUtmLink({ id: link.id, title: link.title, state: "delete-confirmation" })
                      }
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {pagination.pages > 1 ? <Pagination onChangePage={onChangePage} pagination={pagination} /> : null}
          {selectedUtmLink ? (
            <UtmLinkDetails
              utmLink={utmLinkWithStats(selectedUtmLink, utmLinksStats[selectedUtmLink.id])}
              onClose={() => setSelectedUtmLink(null)}
              onDelete={() =>
                setDeletingUtmLink({
                  id: selectedUtmLink.id,
                  title: selectedUtmLink.title,
                  state: "delete-confirmation",
                })
              }
            />
          ) : null}
          {deletingUtmLink ? (
            <Modal
              open
              allowClose={deletingUtmLink.state === "delete-confirmation"}
              onClose={() => setDeletingUtmLink(null)}
              title={t("seller.utm_links.delete_link_title")}
              footer={
                <>
                  <Button disabled={deletingUtmLink.state === "deleting"} onClick={() => setDeletingUtmLink(null)}>
                    {t("actions.cancel")}
                  </Button>
                  {deletingUtmLink.state === "deleting" ? (
                    <Button color="danger" disabled>
                      {t("seller.utm_links.deleting")}
                    </Button>
                  ) : (
                    <Button color="danger" onClick={() => handleDelete(deletingUtmLink.id)}>
                      {t("seller.utm_links.delete")}
                    </Button>
                  )}
                </>
              }
            >
              <h4>{t("seller.utm_links.delete_link_confirm", { title: deletingUtmLink.title })}</h4>
            </Modal>
          ) : null}
        </section>
      ) : query ? (
        <div className="p-4 md:p-8">
          <Placeholder>
            <PlaceholderImage src={noLinksFoundPlaceholder} />
            <h4>{t("seller.utm_links.no_links_found", { query })}</h4>
          </Placeholder>
        </div>
      ) : (
        <div className="p-4 md:p-8">
          <Placeholder>
            <PlaceholderImage src={noLinksYetPlaceholder} />
            <h2>{t("seller.utm_links.no_links_yet")}</h2>
            <h4>{t("seller.utm_links.no_links_yet_desc")}</h4>

            <a href="/help/article/74-the-analytics-dashboard" target="_blank" rel="noreferrer">
              {t("seller.utm_links.learn_more_utm")}
            </a>
          </Placeholder>
        </div>
      )}
    </AnalyticsLayout>
  );
}

const TruncatedTextWithTooltip = ({ text, maxLength }: { text: string; maxLength: number }) => {
  const { truncated, original, isTruncated } = truncateText(text, maxLength);
  return <WithTooltip tip={isTruncated ? original : null}>{truncated}</WithTooltip>;
};

const UtmLinkActions = ({ link, onDelete }: { link: SavedUtmLink; onDelete: () => void }) => {
  const { t } = useTranslate();
  const [open, setOpen] = React.useState(false);

  return (
    <div className="flex flex-wrap gap-3 lg:justify-end" onClick={(e) => e.stopPropagation()}>
      <CopyToClipboard copyTooltip={t("seller.utm_links.copy_short_link")} text={link.short_url}>
        <Button size="icon" aria-label={t("seller.affiliates.copy_link")}>
          <LinkIcon className="size-5" />
        </Button>
      </CopyToClipboard>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverAnchor>
          <PopoverTrigger aria-label={t("seller.utm_links.open_action_menu_aria")} asChild>
            <Button size="icon">
              <DotsHorizontalRounded className="size-5" />
            </Button>
          </PopoverTrigger>
        </PopoverAnchor>
        <PopoverContent className="w-48 border-none p-0 shadow-none" usePortal>
          <Menu>
            <MenuItem asChild>
              <Link href={Routes.edit_dashboard_utm_link_path(link.id)} className="no-underline">
                <Pencil className="size-5" />
                {t("actions.edit")}
              </Link>
            </MenuItem>
            <MenuItem asChild>
              <Link href={Routes.new_dashboard_utm_link_path({ copy_from: link.id })} className="no-underline">
                <Copy className="size-5" />
                {t("seller.utm_links.duplicate")}
              </Link>
            </MenuItem>
            <MenuItem variant="danger" onClick={onDelete}>
              <Trash className="size-5" />
              {t("seller.utm_links.delete")}
            </MenuItem>
          </Menu>
        </PopoverContent>
      </Popover>
    </div>
  );
};

const UtmLinkDetails = ({
  utmLink,
  onClose,
  onDelete,
}: {
  utmLink: SavedUtmLink;
  onClose: () => void;
  onDelete: () => void;
}) => {
  const { t } = useTranslate();
  const userAgentInfo = useUserAgentInfo();
  const isNavigating = useRouteLoading();

  return (
    <Sheet open onOpenChange={onClose}>
      <SheetHeader>{utmLink.title}</SheetHeader>
      <Card asChild>
        <section>
          <CardContent>
            <h3 className="grow">{t("seller.utm_links.details")}</h3>
          </CardContent>
          <CardContent>
            <h5 className="grow font-bold">{t("seller.utm_links.date")}</h5>
            {new Date(utmLink.created_at).toLocaleDateString(userAgentInfo.locale, {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </CardContent>
          {utmLink.destination_option ? (
            <CardContent>
              <h5 className="grow font-bold">{t("seller.utm_links.destination")}</h5>
              <a href={utmLink.destination_option.url} target="_blank" rel="noopener noreferrer">
                {utmLink.destination_option.label}
              </a>
            </CardContent>
          ) : null}
          <CardContent>
            <h5 className="grow font-bold">{t("seller.utm_links.source")}</h5>
            {utmLink.source}
          </CardContent>
          <CardContent>
            <h5 className="grow font-bold">{t("seller.utm_links.medium")}</h5>
            {utmLink.medium}
          </CardContent>
          <CardContent>
            <h5 className="grow font-bold">{t("seller.utm_links.campaign")}</h5>
            {utmLink.campaign}
          </CardContent>
          {utmLink.term ? (
            <CardContent>
              <h5 className="grow font-bold">{t("seller.utm_links.term")}</h5>
              {utmLink.term}
            </CardContent>
          ) : null}
          {utmLink.content ? (
            <CardContent>
              <h5 className="grow font-bold">{t("seller.utm_links.content")}</h5>
              {utmLink.content}
            </CardContent>
          ) : null}
        </section>
      </Card>
      <Card asChild>
        <section>
          <CardContent>
            <h3 className="grow">{t("seller.utm_links.statistics")}</h3>
          </CardContent>
          <CardContent>
            <h5 className="grow font-bold">{t("seller.utm_links.clicks")}</h5>
            {utmLink.clicks}
          </CardContent>
          <CardContent>
            <h5 className="grow font-bold">{t("seller.utm_links.sales")}</h5>
            <div aria-busy={utmLink.sales_count === null} aria-live="polite">
              {utmLink.sales_count !== null ? utmLink.sales_count : <LoadingSpinner />}
            </div>
          </CardContent>
          <CardContent>
            <h5 className="grow font-bold">{t("seller.utm_links.revenue")}</h5>
            <div aria-busy={utmLink.revenue_cents === null} aria-live="polite">
              {utmLink.revenue_cents !== null ? (
                `$${fixedDecimalPointNumber(utmLink.revenue_cents / 100)}`
              ) : (
                <LoadingSpinner />
              )}
            </div>
          </CardContent>
          <CardContent>
            <h5 className="grow font-bold">{t("seller.utm_links.conversion_rate")}</h5>
            <div aria-busy={utmLink.conversion_rate === null} aria-live="polite">
              {utmLink.conversion_rate !== null ? (
                `${fixedDecimalPointNumber(utmLink.conversion_rate * 100)}%`
              ) : (
                <LoadingSpinner />
              )}
            </div>
          </CardContent>
        </section>
      </Card>
      <Card asChild>
        <section>
          <CardContent>
            <h3 className="grow">{t("seller.utm_links.short_link")}</h3>
            <CopyToClipboard text={utmLink.short_url} copyTooltip={t("seller.utm_links.copy_short_link")}>
              <Button aria-label={t("seller.utm_links.copy_short_link")}>
                <LinkIcon className="size-5" />
              </Button>
            </CopyToClipboard>
          </CardContent>
          <CardContent>
            <h5 className="grow font-bold">{utmLink.short_url}</h5>
          </CardContent>
        </section>
      </Card>
      <Card asChild>
        <section>
          <CardContent>
            <h3 className="grow">{t("seller.utm_links.utm_link")}</h3>
            <CopyToClipboard text={utmLink.utm_url} copyTooltip={t("seller.utm_links.copy_utm_link")}>
              <Button aria-label={t("seller.utm_links.copy_utm_link")}>
                <LinkIcon className="size-5" />
              </Button>
            </CopyToClipboard>
          </CardContent>
          <CardContent>
            <h5 className="grow font-bold">{utmLink.utm_url}</h5>
          </CardContent>
        </section>
      </Card>
      <div style={{ display: "grid", gridAutoFlow: "column", gap: "var(--spacer-4)" }}>
        <Button asChild>
          <Link href={Routes.new_dashboard_utm_link_path({ copy_from: utmLink.id })}>
            {t("seller.utm_links.duplicate")}
          </Link>
        </Button>
        <NavigationButtonInertia href={Routes.edit_dashboard_utm_link_path(utmLink.id)} disabled={isNavigating}>
          {t("actions.edit")}
        </NavigationButtonInertia>
        <Button color="danger" onClick={onDelete}>
          {t("seller.utm_links.delete")}
        </Button>
      </div>
    </Sheet>
  );
};
