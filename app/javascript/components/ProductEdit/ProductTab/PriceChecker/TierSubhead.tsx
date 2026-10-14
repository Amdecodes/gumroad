import * as React from "react";

import { useTranslation } from "$app/utils/i18n";

export const TierSubhead = ({
  matchCount,
  tier,
  taxonomyLabel,
  productTypeLabel,
}: {
  matchCount: number;
  tier: "with_taxonomy" | "broadened";
  taxonomyLabel: string | null;
  productTypeLabel: string;
}) => {
  const { t } = useTranslation();
  const text = (() => {
    if (tier === "with_taxonomy" && taxonomyLabel) {
      return t("seller.productEdit.based_on_taxonomy", "Based on %{count} %{productType} in %{taxonomy}.", {
        count: matchCount,
        productType: productTypeLabel,
        taxonomy: taxonomyLabel,
      });
    }
    if (tier === "with_taxonomy") {
      return t("seller.productEdit.based_on_general", "Based on %{count} %{productType} on Gumroad.", {
        count: matchCount,
        productType: productTypeLabel,
      });
    }
    return t(
      "seller.productEdit.based_on_broadened",
      "Based on %{count} %{productType} (broadened — set a category to refine).",
      { count: matchCount, productType: productTypeLabel },
    );
  })();

  return <small className="block text-muted">{text}</small>;
};
