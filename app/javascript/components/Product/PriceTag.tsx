import * as React from "react";

import { classNames } from "$app/utils/classNames";
import {
  CurrencyCode,
  formatBuyerLocalOrSetPrice,
  formatPriceCentsWithoutCurrencySymbolAndComma,
} from "$app/utils/currency";
import { formatRecurrenceWithDuration, RecurrenceId } from "$app/utils/recurringPricing";

type Props = {
  url?: string;
  currencyCode: CurrencyCode;
  price: number;
  oldPrice?: number | undefined;
  recurrence?:
    | {
        id: RecurrenceId;
        duration_in_months: number | null;
      }
    | undefined;
  isPayWhatYouWant: boolean;
  isSalesLimited: boolean;
  creatorName?: string | undefined;
  buyerCurrency?: string | null | undefined;
  buyerLocalCurrencyRate?: number | null | undefined;
  buyerLocalCurrencySubunitToUnit?: number | null | undefined;
  buyerLocalPriceCents?: number | null | undefined;
  buyerLocalOriginalPriceCents?: number | null | undefined;
};

export const PriceTag = ({
  url,
  currencyCode,
  oldPrice,
  price,
  recurrence,
  isPayWhatYouWant,
  isSalesLimited,
  creatorName,
  buyerCurrency,
  buyerLocalCurrencyRate,
  buyerLocalCurrencySubunitToUnit,
  buyerLocalPriceCents,
  buyerLocalOriginalPriceCents,
}: Props) => {
  const buyerLocalContext = { currencyCode, buyerCurrency, buyerLocalCurrencyRate, buyerLocalCurrencySubunitToUnit };
  const formatDisplayPrice = (amountCents: number, fallbackLocalCents?: number | null) =>
    formatBuyerLocalOrSetPrice(amountCents, buyerLocalContext, { fallbackLocalCents });

  const recurrenceLabel = recurrence
    ? formatRecurrenceWithDuration(recurrence.id, recurrence.duration_in_months)
    : null;

  const priceTag = (
    <>
      {oldPrice != null ? (
        <>
          <s>{formatDisplayPrice(oldPrice, buyerLocalOriginalPriceCents)}</s>{" "}
        </>
      ) : null}
      {formatDisplayPrice(price, buyerLocalPriceCents)}
      {isPayWhatYouWant ? "+" : null}
      {recurrenceLabel ? ` ${recurrenceLabel}` : null}
    </>
  );
  return (
    <div itemScope itemProp="offers" itemType="https://schema.org/Offer" className="flex shrink-0 items-center">
      <div className={classNames(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-sm font-bold leading-none shadow-xs",
        price === 0
          ? "border-border bg-active-bg text-foreground"
          : "border-lime/40 bg-lime text-black",
      )}>
        <span
          className="whitespace-nowrap"
          itemProp="price"
          content={formatPriceCentsWithoutCurrencySymbolAndComma(currencyCode, price)}
        >
          {priceTag}
        </span>
      </div>
      <link itemProp="url" href={url} />
      <div itemProp="availability" className="hidden">
        {`https://schema.org/${isSalesLimited ? "LimitedAvailability" : "InStock"}`}
      </div>
      <div itemProp="priceCurrency" className="hidden">
        {currencyCode.toUpperCase()}
      </div>
      {creatorName ? (
        <div itemProp="seller" itemType="https://schema.org/Person" className="hidden">
          <div itemProp="name" className="hidden">
            {creatorName}
          </div>
        </div>
      ) : null}
    </div>
  );
};
