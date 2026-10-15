import { ChevronDown, ChevronUp, CodeAlt, Plus, Trash } from "@boxicons/react";
import { useForm, usePage } from "@inertiajs/react";
import * as React from "react";
import typia from "typia";

import { Snippet, SNIPPET_LOCATIONS, ThirdPartyAnalytics } from "$app/data/third_party_analytics";
import { SettingPage } from "$app/parsers/settings";
import { useTranslate } from "$app/utils/i18n";

import { Button } from "$app/components/Button";
import { Dropdown } from "$app/components/Dropdown";
import { useLoggedInUser } from "$app/components/LoggedInUser";
import { Layout as SettingsLayout } from "$app/components/Settings/Layout";
import { TypeSafeOptionSelect } from "$app/components/TypeSafeOptionSelect";
import { Checkbox } from "$app/components/ui/Checkbox";
import { Details, DetailsToggle } from "$app/components/ui/Details";
import { Fieldset, FieldsetDescription, FieldsetTitle } from "$app/components/ui/Fieldset";
import { FormSection } from "$app/components/ui/FormSection";
import { InlineList } from "$app/components/ui/InlineList";
import { Input } from "$app/components/ui/Input";
import { Label } from "$app/components/ui/Label";
import { Placeholder } from "$app/components/ui/Placeholder";
import { Row, RowActions, RowContent, RowDetails, Rows } from "$app/components/ui/Rows";
import { Switch } from "$app/components/ui/Switch";
import { Textarea } from "$app/components/ui/Textarea";

type Products = { permalink: string; name: string }[];

type ThirdPartyAnalyticsPageProps = {
  settings_pages: SettingPage[];
  third_party_analytics: ThirdPartyAnalytics;
  products: Products;
};

export default function ThirdPartyAnalyticsPage() {
  const { t } = useTranslate();
  const props = typia.assert<ThirdPartyAnalyticsPageProps>(usePage().props);
  const loggedInUser = useLoggedInUser();

  const form = useForm({
    user: props.third_party_analytics,
  });

  const thirdPartyAnalytics = form.data.user;
  const updateThirdPartyAnalytics = (update: Partial<ThirdPartyAnalytics>) =>
    form.setData("user", {
      ...form.data.user,
      ...update,
    });

  const uid = React.useId();

  const addSnippetButton = (
    <Button
      color="primary"
      onClick={() =>
        updateThirdPartyAnalytics({
          snippets: [
            ...thirdPartyAnalytics.snippets,
            { id: `${NEW_SNIPPET_ID_PREFIX}${Math.random()}`, name: "", location: "receipt", code: "", product: null },
          ],
        })
      }
    >
      <Plus className="size-5" />
      {t("seller.settings.analytics.add_snippet")}
    </Button>
  );
  const handleSave = () => {
    form.transform((data) => ({
      user: {
        ...data.user,
        snippets: data.user.snippets.map((snippet: Snippet) => ({
          ...snippet,
          id: snippet.id && !snippet.id.startsWith(NEW_SNIPPET_ID_PREFIX) ? snippet.id : null,
        })),
      },
    }));

    form.put(Routes.settings_third_party_analytics_path(), {
      preserveScroll: true,
    });
  };

  return (
    <SettingsLayout
      currentPage="third_party_analytics"
      pages={props.settings_pages}
      onSave={handleSave}
      canUpdate={Boolean(loggedInUser?.policies.settings_third_party_analytics_user.update) && !form.processing}
    >
      <form>
        <FormSection
          header={
            <>
              <h2>{t("seller.settings.analytics.third_party_analytics_title")}</h2>
              <a href="/help/article/174-third-party-analytics" target="_blank" rel="noreferrer">
                {t("seller.settings.team.learn_more")}
              </a>
              <div>{t("seller.settings.analytics.third_party_analytics_desc")}</div>
            </>
          }
        >
          <Details open={!thirdPartyAnalytics.disable_third_party_analytics}>
            <DetailsToggle chevronPosition="none" className="mb-0">
              <Switch
                checked={!thirdPartyAnalytics.disable_third_party_analytics}
                onChange={(evt) => updateThirdPartyAnalytics({ disable_third_party_analytics: !evt.target.checked })}
                label={t("seller.settings.analytics.enable_third_party_analytics")}
              />
            </DetailsToggle>
            <Dropdown className="flex flex-col gap-4">
              <Fieldset>
                <FieldsetTitle>
                  <Label htmlFor={`${uid}googleAnalyticsId`}>
                    {t("seller.settings.analytics.google_analytics_id")}
                  </Label>
                  <a
                    href="/help/article/174-third-party-analytics#Google-Analytics-Ib1dB"
                    target="_blank"
                    rel="noreferrer"
                  >
                    {t("seller.settings.team.learn_more")}
                  </a>
                </FieldsetTitle>
                <Input
                  id={`${uid}googleAnalyticsId`}
                  type="text"
                  placeholder="G-ABCD232DSE"
                  value={thirdPartyAnalytics.google_analytics_id}
                  onChange={(evt) => updateThirdPartyAnalytics({ google_analytics_id: evt.target.value })}
                />
              </Fieldset>
              <Fieldset>
                <FieldsetTitle>
                  <Label htmlFor={`${uid}facebookPixel`}>{t("seller.settings.analytics.facebook_pixel")}</Label>
                  <a href="/help/article/174-third-party-analytics#Meta-Pixel-Yisi6" target="_blank" rel="noreferrer">
                    {t("seller.settings.team.learn_more")}
                  </a>
                </FieldsetTitle>
                <Input
                  id={`${uid}facebookPixel`}
                  type="text"
                  placeholder="9127380912836192"
                  value={thirdPartyAnalytics.facebook_pixel_id}
                  onChange={(evt) => updateThirdPartyAnalytics({ facebook_pixel_id: evt.target.value })}
                />
              </Fieldset>
              <Fieldset>
                <FieldsetTitle>
                  <Label htmlFor={`${uid}tiktokPixel`}>{t("seller.settings.analytics.tiktok_pixel")}</Label>
                  <a href="/help/article/174-third-party-analytics#TikTok-Pixel-zK9mP" target="_blank" rel="noreferrer">
                    {t("seller.settings.team.learn_more")}
                  </a>
                </FieldsetTitle>
                <Input
                  id={`${uid}tiktokPixel`}
                  type="text"
                  placeholder="CFH83AJC77UUUGLE2TJG"
                  value={thirdPartyAnalytics.tiktok_pixel_id}
                  onChange={(evt) => updateThirdPartyAnalytics({ tiktok_pixel_id: evt.target.value })}
                />
              </Fieldset>
              <Label>
                <Checkbox
                  checked={!thirdPartyAnalytics.skip_free_sale_analytics}
                  onChange={(evt) => updateThirdPartyAnalytics({ skip_free_sale_analytics: !evt.target.checked })}
                />
                {t("seller.settings.analytics.send_purchase_events_free_sales")}
              </Label>
            </Dropdown>
          </Details>
        </FormSection>
        <FormSection header={<h2>{t("seller.settings.analytics.domain_verification")}</h2>}>
          <Details open={thirdPartyAnalytics.enable_verify_domain_third_party_services}>
            <DetailsToggle chevronPosition="none" className="mb-0">
              <Switch
                checked={thirdPartyAnalytics.enable_verify_domain_third_party_services}
                onChange={(evt) =>
                  updateThirdPartyAnalytics({ enable_verify_domain_third_party_services: evt.target.checked })
                }
                label={t("seller.settings.analytics.verify_domain_third_party")}
              />
            </DetailsToggle>
            <Dropdown className="flex flex-col gap-4">
              <Fieldset>
                <FieldsetTitle>
                  <Label htmlFor={`${uid}facebookMetaTag`}>{t("seller.settings.analytics.facebook_business")}</Label>
                  <a href="/help/article/290-facebook-domain-verification" target="_blank" rel="noreferrer">
                    {t("seller.settings.team.learn_more")}
                  </a>
                </FieldsetTitle>
                <Textarea
                  id={`${uid}facebookMetaTag`}
                  placeholder='<meta name="facebook-domain-verification" content="me2vv6lgwoh" />'
                  value={thirdPartyAnalytics.facebook_meta_tag}
                  onChange={(evt) => updateThirdPartyAnalytics({ facebook_meta_tag: evt.target.value })}
                />
                <FieldsetDescription>{t("seller.settings.analytics.enter_meta_tag_desc")}</FieldsetDescription>
              </Fieldset>
            </Dropdown>
          </Details>
        </FormSection>
        <FormSection
          header={
            <>
              <h2>{t("seller.settings.analytics.snippets")}</h2>
              <div>{t("seller.settings.analytics.snippets_desc")}</div>
              <a href="/help/article/174-third-party-analytics#Snippets-j1elc" target="_blank" rel="noreferrer">
                {t("seller.settings.team.learn_more")}
              </a>
            </>
          }
        >
          {thirdPartyAnalytics.snippets.length > 0 ? (
            <>
              <Rows role="list">
                {thirdPartyAnalytics.snippets.map((snippet) => (
                  <SnippetRow
                    key={snippet.id}
                    snippet={snippet}
                    thirdPartyAnalytics={thirdPartyAnalytics}
                    updateThirdPartyAnalytics={updateThirdPartyAnalytics}
                    products={props.products}
                  />
                ))}
              </Rows>
              {addSnippetButton}
            </>
          ) : (
            <Placeholder>{addSnippetButton}</Placeholder>
          )}
        </FormSection>
      </form>
    </SettingsLayout>
  );
}

const NEW_SNIPPET_ID_PREFIX = "__GUMROAD";

const useLocationTitles = (): Record<string, string> => {
  const { t } = useTranslate();
  return {
    receipt: t("seller.settings.analytics.location_receipt"),
    product: t("seller.settings.analytics.location_product"),
    all: t("seller.settings.analytics.location_all"),
  };
};

const SnippetRow = ({
  snippet,
  thirdPartyAnalytics,
  updateThirdPartyAnalytics,
  products,
}: {
  snippet: Snippet;
  thirdPartyAnalytics: ThirdPartyAnalytics;
  updateThirdPartyAnalytics: (update: Partial<ThirdPartyAnalytics>) => void;
  products: Products;
}) => {
  const { t } = useTranslate();
  const locationTitles = useLocationTitles();
  const [expanded, setExpanded] = React.useState(!!snippet.id?.startsWith(NEW_SNIPPET_ID_PREFIX));

  const updateSnippet = (update: Partial<Snippet>) => {
    const snippetIndex = thirdPartyAnalytics.snippets.findIndex(({ id }) => id === snippet.id);
    updateThirdPartyAnalytics({
      snippets: [
        ...thirdPartyAnalytics.snippets.slice(0, snippetIndex),
        { ...snippet, ...update },
        ...thirdPartyAnalytics.snippets.slice(snippetIndex + 1),
      ],
    });
  };

  const uid = React.useId();

  return (
    <Row role="listitem">
      <RowContent>
        <CodeAlt className="type-icon size-5" />
        <div>
          <h4>{snippet.name || t("seller.settings.analytics.snippet_untitled")}</h4>
          <InlineList>
            <li>
              {products.find(({ permalink }) => permalink === snippet.product)?.name ??
                t("seller.settings.analytics.all_products")}
            </li>
            <li>{locationTitles[snippet.location]}</li>
          </InlineList>
        </div>
      </RowContent>
      <RowActions>
        <Button
          size="icon"
          onClick={() => setExpanded((prevExpanded) => !prevExpanded)}
          aria-label={t("seller.settings.analytics.edit_snippet_aria")}
        >
          {expanded ? <ChevronUp className="size-5" /> : <ChevronDown className="size-5" />}
        </Button>
        <Button
          size="icon"
          onClick={() =>
            updateThirdPartyAnalytics({
              snippets: thirdPartyAnalytics.snippets.filter(({ id }) => id !== snippet.id),
            })
          }
          aria-label={t("seller.settings.analytics.delete_snippet_aria")}
        >
          <Trash className="size-5" />
        </Button>
      </RowActions>
      {expanded ? (
        <RowDetails className="flex flex-col gap-4">
          <Fieldset>
            <Label htmlFor={`${uid}name`}>{t("seller.settings.analytics.snippet_name")}</Label>
            <Input
              id={`${uid}name`}
              type="text"
              value={snippet.name}
              onChange={(evt) => updateSnippet({ name: evt.target.value })}
            />
          </Fieldset>
          <Fieldset>
            <Label htmlFor={`${uid}location`}>{t("seller.settings.analytics.snippet_location")}</Label>
            <TypeSafeOptionSelect
              id={`${uid}location`}
              value={snippet.location}
              onChange={(key) => updateSnippet({ location: key })}
              options={SNIPPET_LOCATIONS.map((location) => ({
                id: location,
                label: locationTitles[location] ?? t("seller.settings.analytics.location_receipt"),
              }))}
            />
          </Fieldset>
          <Fieldset>
            <Label htmlFor={`${uid}product`}>{t("seller.settings.analytics.snippet_product")}</Label>
            <TypeSafeOptionSelect
              id={`${uid}product`}
              value={snippet.product ?? ""}
              onChange={(key) => updateSnippet({ product: key || null })}
              options={[
                { id: "", label: t("seller.settings.analytics.all_products") },
                ...products.map(({ permalink, name }) => ({
                  id: permalink,
                  label: name,
                })),
              ]}
            />
          </Fieldset>
          <Fieldset>
            <Label htmlFor={`${uid}code`}>{t("seller.settings.analytics.snippet_code")}</Label>
            <Textarea
              id={`${uid}code`}
              value={snippet.code}
              onChange={(evt) => updateSnippet({ code: evt.target.value })}
            />
          </Fieldset>
        </RowDetails>
      ) : null}
    </Row>
  );
};
