import { XSquare } from "@boxicons/react";
import { useForm, usePage } from "@inertiajs/react";
import * as React from "react";
import typia from "typia";

import { useTranslate } from "$app/hooks/useTranslate";
import { isUrlValid } from "$app/utils/url";

import { Button } from "$app/components/Button";
import { useLoggedInUser } from "$app/components/LoggedInUser";
import { NavigationButtonInertia } from "$app/components/NavigationButton";
import { showAlert } from "$app/components/server-components/Alert";
import { Fieldset, FieldsetTitle } from "$app/components/ui/Fieldset";
import { Input } from "$app/components/ui/Input";
import { Label } from "$app/components/ui/Label";
import { PageHeader } from "$app/components/ui/PageHeader";

import { AffiliateForm, AffiliateProduct } from "./Form";

type AffiliateData = {
  id: string;
  email: string;
  destination_url: string | null;
  affiliate_user_name: string;
  fee_percent: number;
  products: AffiliateProduct[];
};

type Props = {
  affiliate: AffiliateData;
  affiliates_disabled_reason: string | null;
};

export default function AffiliatesEdit() {
  const { t } = useTranslate();
  const props = typia.assert<Props>(usePage().props);
  const loggedInUser = useLoggedInUser();

  const form = useForm<{
    affiliate: {
      email: string;
      products: AffiliateProduct[];
      fee_percent: number | null;
      apply_to_all_products: boolean;
      destination_url: string | null;
    };
  }>({
    affiliate: {
      email: props.affiliate.email,
      products: props.affiliate.products,
      fee_percent: props.affiliate.fee_percent,
      apply_to_all_products: props.affiliate.products.every(
        (p) => p.enabled && p.fee_percent === props.affiliate.fee_percent,
      ),
      destination_url: props.affiliate.destination_url,
    },
  });
  const { data, setData, patch, processing, errors } = form;

  const uid = React.useId();

  const toggleAllProducts = (checked: boolean) => {
    if (checked) {
      setData("affiliate", {
        ...data.affiliate,
        apply_to_all_products: true,
        products: data.affiliate.products.map((p) => ({
          ...p,
          enabled: true,
          fee_percent: data.affiliate.fee_percent,
        })),
      });
    } else {
      setData("affiliate", {
        ...data.affiliate,
        apply_to_all_products: false,
        products: data.affiliate.products.map((p) => ({ ...p, enabled: false })),
      });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    form.clearErrors();

    if (
      data.affiliate.apply_to_all_products &&
      (!data.affiliate.fee_percent || data.affiliate.fee_percent < 1 || data.affiliate.fee_percent > 75)
    ) {
      form.setError("affiliate.fee_percent", t("seller.affiliates.commission_range_error"));
      showAlert(t("seller.affiliates.commission_range_error"), "error");
      return;
    }

    if (!data.affiliate.apply_to_all_products && data.affiliate.products.every((p) => !p.enabled)) {
      form.setError("affiliate.products", t("seller.affiliates.enable_at_least_one_product"));
      showAlert(t("seller.affiliates.enable_at_least_one_product"), "error");
      return;
    }

    if (
      !data.affiliate.apply_to_all_products &&
      data.affiliate.products.some((p) => p.enabled && (!p.fee_percent || p.fee_percent < 1 || p.fee_percent > 75))
    ) {
      form.setError("affiliate.products", t("seller.affiliates.all_enabled_commission_error"));
      showAlert(t("seller.affiliates.all_enabled_commission_error"), "error");
      return;
    }

    if (
      data.affiliate.destination_url &&
      data.affiliate.destination_url !== "" &&
      !isUrlValid(data.affiliate.destination_url)
    ) {
      form.setError("affiliate.destination_url", t("seller.affiliates.valid_url_error"));
      showAlert(t("seller.affiliates.valid_url_error"), "error");
      return;
    }

    patch(typia.assert<string>(Routes.affiliate_path(props.affiliate.id)), {
      onError: (errors: Record<string, string | string[]>) => {
        const message = errors.base
          ? Array.isArray(errors.base)
            ? errors.base[0]
            : errors.base
          : t("seller.affiliates.failed_to_update_affiliate");
        if (message) showAlert(message, "error");
      },
    });
  };

  return (
    <div>
      <PageHeader
        className="sticky-top"
        title={t("seller.affiliates.edit_affiliate")}
        actions={
          <>
            <NavigationButtonInertia href={Routes.affiliates_path()} disabled={processing}>
              <XSquare className="size-5" />
              {t("actions.cancel")}
            </NavigationButtonInertia>
            <Button
              color="accent"
              onClick={handleSubmit}
              disabled={processing || !loggedInUser?.policies.direct_affiliate.update}
            >
              {processing ? t("seller.affiliates.saving") : t("actions.save_changes")}
            </Button>
          </>
        }
      />
      <form onSubmit={handleSubmit}>
        <AffiliateForm
          data={data.affiliate}
          errors={errors}
          processing={processing}
          applyToAllProducts={data.affiliate.apply_to_all_products}
          uid={uid}
          headerText={t("seller.affiliates.edit_affiliate_header")}
          emailField={
            <Fieldset>
              <FieldsetTitle>
                <Label htmlFor={`${uid}email`}>{t("seller.affiliates.email")}</Label>
              </FieldsetTitle>
              <Input type="email" id={`${uid}email`} value={props.affiliate.email} disabled />
            </Fieldset>
          }
          onToggleAllProducts={toggleAllProducts}
          onUpdateFeePercent={(value) => {
            const updatedProducts = data.affiliate.products.map((p) => ({ ...p, fee_percent: value }));
            setData("affiliate", {
              ...data.affiliate,
              fee_percent: value,
              products: updatedProducts,
              apply_to_all_products: updatedProducts.every((p) => p.enabled && p.fee_percent === value),
            });
          }}
          onUpdateDestinationUrl={(value) => setData("affiliate.destination_url", value)}
          onUpdateProduct={(productId, updates) => {
            const updatedProducts = data.affiliate.products.map((p) => (p.id === productId ? { ...p, ...updates } : p));
            const allEnabled = updatedProducts.every((p) => p.enabled && p.fee_percent === data.affiliate.fee_percent);
            setData("affiliate", {
              ...data.affiliate,
              products: updatedProducts,
              apply_to_all_products: allEnabled,
            });
          }}
        />
      </form>
    </div>
  );
}
