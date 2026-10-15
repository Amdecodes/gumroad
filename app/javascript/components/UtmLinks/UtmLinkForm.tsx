import { Link, RefreshCcw, XSquare } from "@boxicons/react";
import { router, useForm } from "@inertiajs/react";
import * as React from "react";
import typia from "typia";

import { useTranslate } from "$app/hooks/useTranslate";
import { UtmLink, UtmLinkDestinationOption, SavedUtmLink } from "$app/types/utm_link";
import { assertDefined } from "$app/utils/assert";

import { AnalyticsLayout } from "$app/components/Analytics/AnalyticsLayout";
import { Button } from "$app/components/Button";
import { CopyToClipboard } from "$app/components/CopyToClipboard";
import { NavigationButtonInertia } from "$app/components/NavigationButton";
import { Select } from "$app/components/Select";
import { showAlert } from "$app/components/server-components/Alert";
import { Fieldset, FieldsetDescription, FieldsetTitle } from "$app/components/ui/Fieldset";
import { FormSection } from "$app/components/ui/FormSection";
import { Input } from "$app/components/ui/Input";
import { InputGroup } from "$app/components/ui/InputGroup";
import { Label } from "$app/components/ui/Label";
import { Pill } from "$app/components/ui/Pill";
import { Textarea } from "$app/components/ui/Textarea";
import { WithTooltip } from "$app/components/WithTooltip";

type UtmLinkFormData = {
  utm_link: {
    title: string;
    target_resource_type: string | null;
    target_resource_id: string | null;
    permalink: string;
    utm_source: string | null;
    utm_medium: string | null;
    utm_campaign: string | null;
    utm_term: string | null;
    utm_content: string | null;
  };
};

type UtmLinkFormContext = {
  destination_options: UtmLinkDestinationOption[];
  short_url: string;
  utm_fields_values: {
    campaigns: string[];
    mediums: string[];
    sources: string[];
    terms: string[];
    contents: string[];
  };
};

type UtmLinkFormAdditionalMetadata = {
  new_permalink: string;
};

export type UtmLinkFormProps = {
  context: UtmLinkFormContext;
  utm_link: UtmLink | null;
  additional_metadata?: UtmLinkFormAdditionalMetadata;
};

export type UtmLinkEditProps = {
  context: UtmLinkFormContext;
  utm_link: SavedUtmLink;
};

const MAX_UTM_PARAM_LENGTH = 200;

type FieldAttrName =
  | "title"
  | "target_resource_id"
  | "target_resource_type"
  | "permalink"
  | "utm_source"
  | "utm_medium"
  | "utm_campaign"
  | "utm_term"
  | "utm_content";

const computeTargetResource = (dest: UtmLinkDestinationOption | null) => {
  if (!dest) return { target_resource_type: null, target_resource_id: null };

  if (["profile_page", "subscribe_page"].includes(dest.id)) {
    return { target_resource_type: dest.id, target_resource_id: null };
  }

  const parts = dest.id.split(/-(.*)/u);
  return {
    target_resource_type: parts[0] || null,
    target_resource_id: parts[1] ?? null,
  };
};

const duplicatedTitle = (title?: string) => (title ? `${title} (copy)` : "");

export const UtmLinkForm = (pageProps: UtmLinkFormProps | UtmLinkEditProps) => {
  const { t } = useTranslate();
  const { context, utm_link } = pageProps;

  const isEditing = utm_link?.id !== undefined;
  const isDuplicating = !isEditing && utm_link !== null;

  const uid = React.useId();

  const [{ shortUrlProtocol, shortUrlPrefix, permalink }, setShortUrl] = React.useState(() => {
    const { protocol: shortUrlProtocol, host, pathname } = new URL(utm_link?.short_url ?? context.short_url);
    const currentPermalink = pathname.split("/").pop() ?? "";
    const shortUrlPrefix = host + pathname.slice(0, -currentPermalink.length);
    return {
      shortUrlProtocol,
      shortUrlPrefix,
      permalink: currentPermalink,
    };
  });
  const [isLoadingNewPermalink, setIsLoadingNewPermalink] = React.useState(false);

  const initialDestination = utm_link?.destination_option?.id
    ? (context.destination_options.find((o) => o.id === assertDefined(utm_link.destination_option).id) ?? null)
    : null;
  const initialTargetResource = computeTargetResource(initialDestination);

  const formKey = isEditing ? `EditUtmLink:${utm_link.id}` : "CreateUtmLink";
  const form = useForm<UtmLinkFormData>(formKey, {
    utm_link: {
      title: isDuplicating ? duplicatedTitle(utm_link.title) : (utm_link?.title ?? ""),
      target_resource_type: initialTargetResource.target_resource_type,
      target_resource_id: initialTargetResource.target_resource_id,
      permalink,
      utm_source: utm_link?.source ?? null,
      utm_medium: utm_link?.medium ?? null,
      utm_campaign: utm_link?.campaign ?? null,
      utm_term: utm_link?.term ?? null,
      utm_content: utm_link?.content ?? null,
    },
  });
  const { data, setData, post, patch, processing, errors } = form;

  const [destination, setDestination] = React.useState<UtmLinkDestinationOption | null>(initialDestination);

  const titleRef = React.useRef<HTMLInputElement>(null);

  // Clear the error for the field the user just edited, from inside the same event that changed it.
  // This used to be an effect that wiped every error whenever `data` changed. Because effects run
  // after the render, that clear could still be pending when the next "Add link" click ran its own
  // validation: the click would set a fresh "Must be present" error and the queued clear would then
  // wipe it, so the field never turned red. That interleaving is the flake in
  // spec/requests/analytics/utm_links_spec.rb "shows validation errors" (issue #6487).
  //
  // Read the errors through a ref rather than the closed-over value, because one caller (the
  // permalink refresh below) runs in an async callback whose closure was captured before the
  // request started, and by then the error state may have moved on.
  const errorsRef = React.useRef(errors);
  errorsRef.current = errors;

  // Skipping the call when nothing is set matters: clearErrors always produces a new errors object,
  // which would re-fire the scroll effect below on every keystroke.
  const clearFieldErrors = (...attrNames: FieldAttrName[]) => {
    const keys = attrNames
      .map((attrName) => `utm_link.${attrName}` as const)
      .filter((key) => errorsRef.current[key] !== undefined);
    if (keys.length > 0) form.clearErrors(...keys);
  };

  React.useLayoutEffect(() => {
    if (Object.keys(errors).length > 0) {
      document.querySelector("fieldset.danger")?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }, [errors]);

  const getFieldError = (attrName: FieldAttrName): string | undefined => {
    const error = errors[`utm_link.${attrName}`];
    if (error) return error;

    if (attrName === "target_resource_id" || attrName === "target_resource_type") {
      return errors["utm_link.target_resource_id"] || errors["utm_link.target_resource_type"] || undefined;
    }

    return undefined;
  };

  const finalUrl = React.useMemo(() => {
    if (destination && data.utm_link.utm_source && data.utm_link.utm_medium && data.utm_link.utm_campaign) {
      const params = new URLSearchParams();
      params.set("utm_source", data.utm_link.utm_source);
      params.set("utm_medium", data.utm_link.utm_medium);
      params.set("utm_campaign", data.utm_link.utm_campaign);
      if (data.utm_link.utm_term) params.set("utm_term", data.utm_link.utm_term);
      if (data.utm_link.utm_content) params.set("utm_content", data.utm_link.utm_content);
      return [destination.url, params.toString()].filter(Boolean).join("?");
    }
    return null;
  }, [
    destination,
    data.utm_link.utm_source,
    data.utm_link.utm_medium,
    data.utm_link.utm_campaign,
    data.utm_link.utm_term,
    data.utm_link.utm_content,
  ]);

  const generateNewPermalink = () => {
    setIsLoadingNewPermalink(true);
    router.reload({
      only: ["additional_metadata"],
      onSuccess: (page) => {
        const additionalMetadata = typia.assert<UtmLinkFormAdditionalMetadata | undefined>(
          page.props.additional_metadata,
        );
        const newPermalink = additionalMetadata?.new_permalink;
        if (newPermalink) {
          setShortUrl((shortUrl) => ({ ...shortUrl, permalink: newPermalink }));
          setData("utm_link.permalink", newPermalink);
          clearFieldErrors("permalink");
        }
      },
      onError: () => {
        showAlert("Sorry, something went wrong. Please try again.", "error");
      },
      onFinish: () => {
        setIsLoadingNewPermalink(false);
      },
    });
  };

  const validate = () => {
    form.clearErrors();

    if (data.utm_link.title.trim().length === 0) {
      form.setError("utm_link.title", t("seller.utm_links.must_be_present"));
      titleRef.current?.focus();
      return false;
    }

    if (!isEditing && !destination) {
      form.setError("utm_link.target_resource_id", t("seller.utm_links.must_be_present"));
      return false;
    }

    if (!data.utm_link.utm_source || data.utm_link.utm_source.trim().length === 0) {
      form.setError("utm_link.utm_source", t("seller.utm_links.must_be_present"));
      return false;
    }

    if (!data.utm_link.utm_medium || data.utm_link.utm_medium.trim().length === 0) {
      form.setError("utm_link.utm_medium", t("seller.utm_links.must_be_present"));
      return false;
    }

    if (!data.utm_link.utm_campaign || data.utm_link.utm_campaign.trim().length === 0) {
      form.setError("utm_link.utm_campaign", t("seller.utm_links.must_be_present"));
      return false;
    }

    return true;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const onError = (submitErrors: Record<string, string | string[]>) => {
      const firstError = Object.values(submitErrors)[0];
      const message = Array.isArray(firstError) ? firstError[0] : firstError;
      if (message) showAlert(message, "error");
    };

    if (isEditing && utm_link.id) {
      patch(Routes.dashboard_utm_link_path(utm_link.id), { onError });
    } else {
      const url = new URL(window.location.href);
      const copyFrom = url.searchParams.get("copy_from");
      const postUrl = copyFrom
        ? Routes.dashboard_utm_links_path({ copy_from: copyFrom })
        : Routes.dashboard_utm_links_path();

      post(postUrl, { onError });
    }
  };

  return (
    <AnalyticsLayout
      selectedTab="utm_links"
      showTabs={false}
      title={isEditing ? t("seller.utm_links.edit_link") : t("seller.utm_links.create_link")}
      actions={
        <>
          <NavigationButtonInertia href={Routes.dashboard_utm_links_path()} disabled={processing}>
            <XSquare className="size-5" />
            {t("actions.cancel")}
          </NavigationButtonInertia>
          <Button color="accent" onClick={handleSubmit} disabled={processing}>
            {processing ? t("actions.saving") : isEditing ? t("actions.save_changes") : t("seller.utm_links.add_link")}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit}>
        <FormSection
          header={
            <>
              <p>{t("seller.utm_links.form_desc_1")}</p>
              <p>{t("seller.utm_links.form_desc_2")}</p>
              <a href="/help/article/74-the-analytics-dashboard" target="_blank" rel="noreferrer">
                {t("actions.learn_more")}
              </a>
            </>
          }
        >
          <Fieldset state={getFieldError("title") ? "danger" : undefined}>
            <FieldsetTitle>
              <Label htmlFor={`title-${uid}`}>{t("seller.utm_links.title")}</Label>
            </FieldsetTitle>
            <Input
              id={`title-${uid}`}
              type="text"
              value={data.utm_link.title}
              ref={titleRef}
              onChange={(e) => {
                setData("utm_link.title", e.target.value);
                clearFieldErrors("title");
              }}
            />
            {getFieldError("title") ? <FieldsetDescription>{getFieldError("title")}</FieldsetDescription> : null}
          </Fieldset>
          <Fieldset
            state={getFieldError("target_resource_id") || getFieldError("target_resource_type") ? "danger" : undefined}
          >
            <FieldsetTitle>
              <Label htmlFor={`destination-${uid}`}>{t("seller.utm_links.destination")}</Label>
            </FieldsetTitle>
            <Select
              inputId={`destination-${uid}`}
              instanceId={`destination-${uid}`}
              options={context.destination_options}
              value={destination}
              isMulti={false}
              isDisabled={isEditing}
              onChange={(option) => {
                const newDest = option ? (context.destination_options.find((o) => o.id === option.id) ?? null) : null;
                setDestination(newDest);
                const { target_resource_type, target_resource_id } = computeTargetResource(newDest);
                setData("utm_link", { ...data.utm_link, target_resource_type, target_resource_id });
                clearFieldErrors("target_resource_id", "target_resource_type");
              }}
            />
            {getFieldError("target_resource_id") || getFieldError("target_resource_type") ? (
              <FieldsetDescription>
                {getFieldError("target_resource_id") || getFieldError("target_resource_type")}
              </FieldsetDescription>
            ) : null}
          </Fieldset>
          <Fieldset state={getFieldError("permalink") ? "danger" : undefined}>
            <FieldsetTitle>
              <Label htmlFor={`${uid}-link-text`}>{t("seller.utm_links.link")}</Label>
            </FieldsetTitle>
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <InputGroup disabled={isEditing}>
                <Pill className="-ml-2 shrink-0">{shortUrlPrefix}</Pill>
                <Input
                  type="text"
                  id={`${uid}-link-text`}
                  value={isEditing ? permalink : data.utm_link.permalink}
                  readOnly
                  disabled={isEditing}
                />
              </InputGroup>
              <div className="flex gap-2">
                <CopyToClipboard
                  copyTooltip={t("seller.utm_links.copy_short_link")}
                  text={`${shortUrlProtocol}//${shortUrlPrefix}${isEditing ? permalink : data.utm_link.permalink}`}
                >
                  <Button type="button" size="icon" aria-label={t("seller.utm_links.copy_short_link")}>
                    <Link className="size-5" />
                  </Button>
                </CopyToClipboard>
                {!isEditing && (
                  <WithTooltip tip={t("seller.utm_links.generate_new_short_link")}>
                    <Button
                      size="icon"
                      onClick={generateNewPermalink}
                      disabled={isLoadingNewPermalink}
                      aria-label={t("seller.utm_links.generate_new_short_link")}
                    >
                      <RefreshCcw className="size-5" />
                    </Button>
                  </WithTooltip>
                )}
              </div>
            </div>
            {getFieldError("permalink") ? (
              <FieldsetDescription>{getFieldError("permalink")}</FieldsetDescription>
            ) : (
              <FieldsetDescription>{t("seller.utm_links.short_link_help")}</FieldsetDescription>
            )}
          </Fieldset>
          <div
            style={{
              display: "grid",
              gap: "var(--spacer-3)",
              gridTemplateColumns: "repeat(auto-fit, max(var(--dynamic-grid), 50% - var(--spacer-3) / 2))",
            }}
          >
            <Fieldset state={getFieldError("utm_source") ? "danger" : undefined}>
              <FieldsetTitle>
                <Label htmlFor={`${uid}-source`}>{t("seller.utm_links.source")}</Label>
              </FieldsetTitle>
              <UtmFieldSelect
                id={`${uid}-source`}
                baseOptionValues={context.utm_fields_values.sources}
                value={data.utm_link.utm_source}
                onChange={(value) => {
                  setData("utm_link.utm_source", value);
                  clearFieldErrors("utm_source");
                }}
              />
              {getFieldError("utm_source") ? (
                <FieldsetDescription>{getFieldError("utm_source")}</FieldsetDescription>
              ) : (
                <FieldsetDescription>{t("seller.utm_links.source_help")}</FieldsetDescription>
              )}
            </Fieldset>
            <Fieldset state={getFieldError("utm_medium") ? "danger" : undefined}>
              <FieldsetTitle>
                <Label htmlFor={`${uid}-medium`}>{t("seller.utm_links.medium")}</Label>
              </FieldsetTitle>
              <UtmFieldSelect
                id={`${uid}-medium`}
                baseOptionValues={context.utm_fields_values.mediums}
                value={data.utm_link.utm_medium}
                onChange={(value) => {
                  setData("utm_link.utm_medium", value);
                  clearFieldErrors("utm_medium");
                }}
              />
              {getFieldError("utm_medium") ? (
                <FieldsetDescription>{getFieldError("utm_medium")}</FieldsetDescription>
              ) : (
                <FieldsetDescription>{t("seller.utm_links.medium_help")}</FieldsetDescription>
              )}
            </Fieldset>
          </div>
          <Fieldset state={getFieldError("utm_campaign") ? "danger" : undefined}>
            <FieldsetTitle>
              <Label htmlFor={`${uid}-campaign`}>{t("seller.utm_links.campaign")}</Label>
            </FieldsetTitle>
            <UtmFieldSelect
              id={`${uid}-campaign`}
              baseOptionValues={context.utm_fields_values.campaigns}
              value={data.utm_link.utm_campaign}
              onChange={(value) => {
                setData("utm_link.utm_campaign", value);
                clearFieldErrors("utm_campaign");
              }}
            />
            {getFieldError("utm_campaign") ? (
              <FieldsetDescription>{getFieldError("utm_campaign")}</FieldsetDescription>
            ) : (
              <FieldsetDescription>{t("seller.utm_links.campaign_help")}</FieldsetDescription>
            )}
          </Fieldset>
          <Fieldset state={getFieldError("utm_term") ? "danger" : undefined}>
            <FieldsetTitle>
              <Label htmlFor={`${uid}-term`}>{t("seller.utm_links.term")}</Label>
            </FieldsetTitle>
            <UtmFieldSelect
              id={`${uid}-term`}
              baseOptionValues={context.utm_fields_values.terms}
              value={data.utm_link.utm_term}
              onChange={(value) => {
                setData("utm_link.utm_term", value);
                clearFieldErrors("utm_term");
              }}
            />
            {getFieldError("utm_term") ? (
              <FieldsetDescription>{getFieldError("utm_term")}</FieldsetDescription>
            ) : (
              <FieldsetDescription>{t("seller.utm_links.term_help")}</FieldsetDescription>
            )}
          </Fieldset>
          <Fieldset state={getFieldError("utm_content") ? "danger" : undefined}>
            <FieldsetTitle>
              <Label htmlFor={`${uid}-content`}>{t("seller.utm_links.content")}</Label>
            </FieldsetTitle>
            <UtmFieldSelect
              id={`${uid}-content`}
              baseOptionValues={context.utm_fields_values.contents}
              value={data.utm_link.utm_content}
              onChange={(value) => {
                setData("utm_link.utm_content", value);
                clearFieldErrors("utm_content");
              }}
            />
            {getFieldError("utm_content") ? (
              <FieldsetDescription>{getFieldError("utm_content")}</FieldsetDescription>
            ) : (
              <FieldsetDescription>{t("seller.utm_links.content_help")}</FieldsetDescription>
            )}
          </Fieldset>
          {finalUrl ? (
            <Fieldset>
              <FieldsetTitle>
                <Label htmlFor={`${uid}-utm-url`}>{t("seller.utm_links.generated_url_label")}</Label>
              </FieldsetTitle>
              <InputGroup>
                <ResizableTextarea
                  id={`${uid}-utm-url`}
                  className="resize-none"
                  readOnly
                  value={finalUrl}
                  onChange={() => {}}
                />
                <CopyToClipboard copyTooltip={t("seller.utm_links.copy_utm_link")} text={finalUrl}>
                  <Button type="button" size="icon" aria-label={t("seller.utm_links.copy_utm_link")}>
                    <Link className="size-5" />
                  </Button>
                </CopyToClipboard>
              </InputGroup>
            </Fieldset>
          ) : null}
        </FormSection>
      </form>
    </AnalyticsLayout>
  );
};

const UtmFieldSelect = ({
  id,
  placeholder,
  baseOptionValues,
  value,
  onChange,
}: {
  id: string;
  placeholder?: string;
  baseOptionValues: string[];
  value: string | null;
  onChange: (value: string | null) => void;
}) => {
  const { t } = useTranslate();
  const [inputValue, setInputValue] = React.useState<string | null>(null);
  const options = [...new Set([value, inputValue, ...baseOptionValues])]
    .flatMap((val) => (val !== null && val !== "" ? [{ id: val, label: val }] : []))
    .sort((a, b) => a.label.localeCompare(b.label));

  return (
    <Select
      inputId={id}
      instanceId={id}
      placeholder={placeholder}
      isMulti={false}
      isClearable
      escapeClearsValue
      options={options}
      value={value ? (options.find((o) => o.id === value) ?? null) : null}
      onChange={(option) => onChange(option ? option.id : null)}
      inputValue={inputValue ?? ""}
      // Lowercase the value, replace non-alphanumeric characters with dashes, and restrict to 64 characters
      onInputChange={(value) =>
        setInputValue(
          value
            .toLocaleLowerCase()
            .replace(/[^a-z0-9-_]/gu, "-")
            .slice(0, MAX_UTM_PARAM_LENGTH),
        )
      }
      noOptionsMessage={() => t("seller.utm_links.enter_something")}
    />
  );
};

const ResizableTextarea = (props: React.ComponentProps<"textarea">) => {
  const ref = React.useRef<HTMLTextAreaElement | null>(null);
  React.useEffect(() => {
    if (!ref.current) return;
    ref.current.style.height = "inherit";
    ref.current.style.height = `${ref.current.scrollHeight}px`;
  }, [props.value]);

  return <Textarea ref={ref} {...props} />;
};
