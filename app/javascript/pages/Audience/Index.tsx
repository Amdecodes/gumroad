import { ArrowInDownSquareHalf } from "@boxicons/react";
import { Deferred, router, usePage } from "@inertiajs/react";
import { lightFormat } from "date-fns";
import * as React from "react";
import typia from "typia";

import { type AudienceDataByDate } from "$app/data/audience";
import { t } from "$app/utils/i18n";

import { AnalyticsLayout } from "$app/components/Analytics/AnalyticsLayout";
import { useAnalyticsDateRange } from "$app/components/Analytics/useAnalyticsDateRange";
import { AudienceChart } from "$app/components/Audience/AudienceChart";
import { AudienceQuickStats } from "$app/components/Audience/AudienceQuickStats";
import { Button } from "$app/components/Button";
import { DateRangePicker } from "$app/components/DateRangePicker";
import { ExportSubscribersPopover } from "$app/components/Followers/ExportSubscribersPopover";
import { LoadingSpinner } from "$app/components/LoadingSpinner";
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from "$app/components/Popover";
import { InputGroup } from "$app/components/ui/InputGroup";
import { Placeholder, PlaceholderImage } from "$app/components/ui/Placeholder";
import { useOnChange } from "$app/components/useOnChange";

import placeholder from "$assets/images/placeholders/audience.webp";

interface AudiencePageProps {
  total_follower_count: number;
  audience_data?: AudienceDataByDate | null;
}

function Audience() {
  const { total_follower_count, audience_data } = typia.assert<AudiencePageProps>(usePage().props);
  const dateRange = useAnalyticsDateRange();
  const startTime = lightFormat(dateRange.from, "yyyy-MM-dd");
  const endTime = lightFormat(dateRange.to, "yyyy-MM-dd");

  const hasContent = total_follower_count > 0;

  useOnChange(() => {
    if (!hasContent) return;
    router.reload({ only: ["audience_data"], data: { from: startTime, to: endTime } });
  }, [hasContent, startTime, endTime]);

  return (
    <AnalyticsLayout
      selectedTab="following"
      actions={
        hasContent ? (
          <div className="flex w-full gap-2">
            <Popover>
              <PopoverAnchor>
                <PopoverTrigger asChild>
                  <Button>
                    <ArrowInDownSquareHalf aria-hidden="true" className="size-5" />
                    {t("seller.audience.export")}
                  </Button>
                </PopoverTrigger>
              </PopoverAnchor>
              <PopoverContent sideOffset={4}>
                <ExportSubscribersPopover />
              </PopoverContent>
            </Popover>
            <div className="flex-1">
              <DateRangePicker {...dateRange} />
            </div>
          </div>
        ) : null
      }
    >
      {hasContent ? (
        <div className="space-y-8 p-4 md:p-8">
          <AudienceQuickStats
            totalFollowers={total_follower_count}
            newFollowers={audience_data?.new_followers ?? null}
          />
          <Deferred
            data={["audience_data"]}
            fallback={
              <InputGroup>
                <LoadingSpinner />
                {t("seller.audience.loading_charts")}
              </InputGroup>
            }
          >
            {audience_data ? <AudienceChart data={audience_data} /> : null}
          </Deferred>
        </div>
      ) : (
        <div className="p-4 md:p-8">
          <Placeholder>
            <PlaceholderImage src={placeholder} />
            <h2>{t("seller.audience.empty_title")}</h2>
            <p>{t("seller.audience.empty_description")}</p>
            <a href="/help/article/170-audience" target="_blank" rel="noreferrer">
              {t("seller.audience.empty_learn_more")}
            </a>
          </Placeholder>
        </div>
      )}
    </AnalyticsLayout>
  );
}

export default Audience;
