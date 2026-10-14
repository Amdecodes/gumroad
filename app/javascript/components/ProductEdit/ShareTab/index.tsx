import { CartPlus } from "@boxicons/react";
import * as React from "react";

import { useTranslation } from "$app/utils/i18n";

import { Button } from "$app/components/Button";
import { CopyToClipboard } from "$app/components/CopyToClipboard";
import { useCurrentSeller } from "$app/components/CurrentSeller";
import { useDiscoverUrl } from "$app/components/DomainSettings";
import { Layout, useProductUrl } from "$app/components/ProductEdit/Layout";
import { ProductPreview } from "$app/components/ProductEdit/ProductPreview";
import { CartRecoveryCard } from "$app/components/ProductEdit/ShareTab/CartRecoveryCard";
import { LandingPageEditor } from "$app/components/ProductEdit/ShareTab/LandingPageEditor";
import { ProfileSectionsEditor } from "$app/components/ProductEdit/ShareTab/ProfileSectionsEditor";
import { ShareYourLaunchCard } from "$app/components/ProductEdit/ShareTab/ShareYourLaunchCard";
import { TagSelector } from "$app/components/ProductEdit/ShareTab/TagSelector";
import { TaxonomyAttributesEditor } from "$app/components/ProductEdit/ShareTab/TaxonomyAttributesEditor";
import { TaxonomyEditor } from "$app/components/ProductEdit/ShareTab/TaxonomyEditor";
import { useProductEditContext } from "$app/components/ProductEdit/state";
import { ShareButtons } from "$app/components/ShareButtons";
import { Alert } from "$app/components/ui/Alert";
import { Fieldset } from "$app/components/ui/Fieldset";
import { LinkButton } from "$app/components/ui/LinkButton";
import { Switch } from "$app/components/ui/Switch";
import { useRunOnce } from "$app/components/useRunOnce";

import hands from "$assets/images/illustrations/hands.png";

export const ShareTab = () => {
  const { t } = useTranslation();
  const currentSeller = useCurrentSeller();

  const {
    product,
    uniquePermalink,
    updateProduct,
    profileSections,
    taxonomies,
    taxonomyAttributes,
    isListedOnDiscover,
    autoMarketingEnabled,
  } = useProductEditContext();

  const url = useProductUrl();
  const checkoutUrl = useProductUrl({ wanted: true });
  const discoverUrl = useDiscoverUrl();

  if (!currentSeller) return;
  const discoverLink = new URL(discoverUrl);
  discoverLink.searchParams.set("query", product.name);

  return (
    <Layout preview={<ProductPreview />}>
      <div className="squished">
        <form>
          <section className="grid gap-8 p-4! md:p-8!">
            <DiscoverEligibilityPromo />
            <header>
              <h2>{t("seller.productEdit.share_title")}</h2>
            </header>
            <ShareButtons
              url={url}
              twitterText={t("seller.productEdit.share_twitter_text", { name: product.name })}
              facebookText={product.name}
            >
              {/* The header used to carry a "Copy checkout link" button; it lives here now so the
                  header stays at just Unpublish + Save changes. */}
              <CopyToClipboard
                text={checkoutUrl}
                copyTooltip={t("seller.productEdit.copy_checkout_url")}
                tooltipPosition="top"
              >
                <Button>
                  <CartPlus className="size-5" />
                  {t("seller.productEdit.copy_checkout_url")}
                </Button>
              </CopyToClipboard>
            </ShareButtons>
            {autoMarketingEnabled && product.is_published ? (
              <>
                <ShareYourLaunchCard productPermalink={uniquePermalink} />
                <CartRecoveryCard productPermalink={uniquePermalink} />
              </>
            ) : null}
          </section>
          <LandingPageEditor />
          <ProfileSectionsEditor
            sectionIds={product.section_ids}
            onChange={(sectionIds) => updateProduct({ section_ids: sectionIds })}
            profileSections={profileSections}
          />
          <section className="grid gap-8 border-t border-border p-4 md:p-8">
            <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <h2>{t("seller.productEdit.discover_title")}</h2>
              <a href="/help/article/79-gumroad-discover" target="_blank" rel="noreferrer">
                {t("seller.productEdit.learn_more")}
              </a>
            </header>
            {isListedOnDiscover ? (
              <Alert role="status" variant="success">
                <div className="flex flex-col justify-between sm:flex-row">
                  {t("seller.productEdit.discover_listed", { name: product.name })}
                  <a href={discoverLink.toString()}>{t("seller.productEdit.view")}</a>
                </div>
              </Alert>
            ) : null}
            <div className="flex flex-col gap-4">
              <p>{t("seller.productEdit.discover_fee_info")}</p>
              <p>{t("seller.productEdit.discover_affiliate_info")}</p>
            </div>
            <TaxonomyEditor
              taxonomyId={product.taxonomy_id}
              onChange={(taxonomy_id) => updateProduct({ taxonomy_id })}
              taxonomies={taxonomies}
            />
            <TaxonomyAttributesEditor
              attributes={taxonomyAttributes.filter((attribute) => attribute.taxonomy_id === product.taxonomy_id)}
              values={product.taxonomy_attribute_values}
              inferredValues={product.inferred_taxonomy_attribute_values}
              setValues={(taxonomy_attribute_values) => updateProduct({ taxonomy_attribute_values })}
            />
            <TagSelector tags={product.tags} onChange={(tags) => updateProduct({ tags })} />
            <Fieldset>
              <Switch
                checked={product.display_product_reviews}
                onChange={(e) => updateProduct({ display_product_reviews: e.target.checked })}
                label={t("seller.productEdit.display_reviews_label")}
              />
              <Switch
                checked={product.is_adult}
                onChange={(e) => updateProduct({ is_adult: e.target.checked })}
                label={
                  <>
                    {t("seller.productEdit.adult_content_label_prefix")}{" "}
                    <a href="/help/article/156-gumroad-and-adult-content" target="_blank" rel="noreferrer">
                      {t("seller.productEdit.adult_content_label_link")}
                    </a>{" "}
                    {t("seller.productEdit.adult_content_label_suffix")}
                  </>
                }
              />
            </Fieldset>
          </section>
        </form>
      </div>
    </Layout>
  );
};

const DiscoverEligibilityPromo = () => {
  const { t } = useTranslation();
  const [show, setShow] = React.useState(false);

  useRunOnce(() => {
    if (localStorage.getItem("showDiscoverEligibilityPromo") !== "false") setShow(true);
  });

  if (!show) return null;

  return (
    <Alert role="status">
      <div className="flex items-center gap-2">
        <img src={hands} alt="" className="size-12" />
        <div className="flex flex-1 flex-col gap-2">
          <div>
            {t("seller.productEdit.discover_eligibility_notice_1")}{" "}
            <a href="/help/article/79-gumroad-discover" target="_blank" rel="noreferrer">
              {t("seller.productEdit.discover_eligibility_link_criteria")}
            </a>
            {t("seller.productEdit.discover_eligibility_notice_2")}{" "}
            <a href="/help/article/13-getting-paid" target="_blank" rel="noreferrer">
              {t("seller.productEdit.discover_eligibility_link_here")}
            </a>
            {t("seller.productEdit.discover_eligibility_notice_3")}
          </div>
          <LinkButton
            className="w-max"
            onClick={() => {
              localStorage.setItem("showDiscoverEligibilityPromo", "false");
              setShow(false);
            }}
          >
            {t("seller.productEdit.close")}
          </LinkButton>
        </div>
      </div>
    </Alert>
  );
};
