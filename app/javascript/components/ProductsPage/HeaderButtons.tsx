import { usePage } from "@inertiajs/react";
import React from "react";
import typia from "typia";

import { t } from "$app/utils/i18n";

import { NavigationButtonInertia } from "$app/components/NavigationButton";
import { Search } from "$app/components/Search";

type Props = {
  query: string;
  setQuery: (query: string) => void;
};

type PageProps = {
  has_products: boolean;
  can_create_product: boolean;
};

export const HeaderButtons = ({ query, setQuery }: Props) => {
  const { can_create_product: canCreateProduct, has_products: hasProducts } = typia.assert<PageProps>(usePage().props);

  return (
    <>
      {hasProducts ? (
        <Search value={query} onSearch={setQuery} placeholder={t("seller.products.search_placeholder")} />
      ) : null}
      <NavigationButtonInertia href={Routes.new_product_path()} disabled={!canCreateProduct} color="accent">
        {t("seller.products.new_product")}
      </NavigationButtonInertia>
    </>
  );
};
