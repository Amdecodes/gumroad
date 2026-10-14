import { Check, X } from "@boxicons/react";
import * as React from "react";

import { useTranslation } from "$app/utils/i18n";

const stripTags = (html: string) => html.replace(/<[^>]*>/gu, "").trim();

type CheckRow = {
  label: string;
  passed: boolean;
  hint?: React.ReactNode;
};

const Icon = ({ passed }: { passed: boolean }) => {
  const { t } = useTranslation();
  return passed ? (
    <Check className="size-4 shrink-0 text-success" aria-label={t("seller.productEdit.check_met", "Met")} />
  ) : (
    <X className="size-4 shrink-0 text-danger" aria-label={t("seller.productEdit.check_missing", "Missing")} />
  );
};

export const Checklist = ({
  productNativeType,
  productName,
  productDescription,
  taxonomyId,
  productTypeLabel,
  tagline,
}: {
  productNativeType: string | null | undefined;
  productName: string;
  productDescription: string;
  taxonomyId: string | null;
  productTypeLabel: string;
  tagline?: React.ReactNode;
}) => {
  const { t } = useTranslation();
  const descriptionLength = stripTags(productDescription).length;
  const rows: CheckRow[] = [
    {
      label: t("seller.productEdit.check_product_type", "Product type — %{productType}", {
        productType: productTypeLabel,
      }),
      passed: Boolean(productNativeType),
    },
    {
      label: t("seller.productEdit.check_product_name", "Product name"),
      passed: productName.trim().length > 0,
    },
    {
      label: t("seller.productEdit.check_description", "Description (50+ characters)"),
      passed: descriptionLength >= 50,
      hint: descriptionLength > 0 ? t("seller.productEdit.characters_count", { count: descriptionLength }) : undefined,
    },
    {
      label: t("seller.productEdit.check_category", "Category"),
      passed: taxonomyId != null,
      hint:
        taxonomyId == null
          ? t("seller.productEdit.check_category_hint", "Set in Share tab to refine matches")
          : undefined,
    },
  ];

  return (
    <div className="grid gap-1.5 text-left">
      {tagline ? <div className="text-sm">{tagline}</div> : null}
      <div className="text-xs tracking-wide uppercase opacity-70">
        {t("seller.productEdit.match_accuracy", "Match accuracy")}
      </div>
      <ul className="m-0 grid list-none gap-1.5 p-0">
        {rows.map((row) => (
          <li key={row.label} className="flex items-start gap-2 text-sm leading-tight">
            <Icon passed={row.passed} />
            <div className="min-w-0 flex-1">
              <div>{row.label}</div>
              {row.hint ? <div className="text-xs opacity-70">{row.hint}</div> : null}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};
