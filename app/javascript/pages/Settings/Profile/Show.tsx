import { FontFamily } from "@boxicons/react";
import { Link, router, usePage } from "@inertiajs/react";
import { capitalize, isEqual } from "lodash-es";
import * as React from "react";
import typia from "typia";

import { updateProfileSettings as saveProfileSettings } from "$app/data/profile_settings";
import {
  ProfileSettingsForm,
  changedProfileSettings,
  profileThemeColors,
  rebaseProfileSettings,
} from "$app/pages/Settings/Profile/profileSettingsForm";
import { CreatorProfile } from "$app/parsers/profile";
import { classNames } from "$app/utils/classNames";
import { useTranslate } from "$app/utils/i18n";
import { assertResponseError } from "$app/utils/request";

import { Button, NavigationButton } from "$app/components/Button";
import { type EmailConfirmation, EmailConfirmationBanner } from "$app/components/EmailConfirmationBanner";
import { useLoggedInUser } from "$app/components/LoggedInUser";
import { Preview } from "$app/components/Preview";
import { PreviewChrome, PreviewSidebar, WithPreviewSidebar } from "$app/components/PreviewSidebar";
import { Props as ProfileProps } from "$app/components/Profile";
import { EditProfile, ProfileEditorProps, ProfileEditorState } from "$app/components/Profile/EditPage";
import { ProfileLandingPagePreview } from "$app/components/Profile/LandingPagePreview";
import { Layout as ProfileLayout } from "$app/components/Profile/Layout";
import { ProfileSectionsForm } from "$app/components/Profile/SectionsForm";
import { LogoInput } from "$app/components/Profile/Settings/LogoInput";
import { showAlert } from "$app/components/server-components/Alert";
import { ToggleSettingRow } from "$app/components/SettingRow";
import { postToMobileApp } from "$app/components/Settings/Layout";
import { ShareButtons } from "$app/components/ShareButtons";
import { AgentSupportFallbackNote } from "$app/components/Support/AgentSupportFallbackNote";
import { Alert } from "$app/components/ui/Alert";
import { ColorPicker } from "$app/components/ui/ColorPicker";
import { Fieldset, FieldsetDescription, FieldsetTitle } from "$app/components/ui/Fieldset";
import { Input } from "$app/components/ui/Input";
import { Label } from "$app/components/ui/Label";
import { PageHeader } from "$app/components/ui/PageHeader";
import { Select } from "$app/components/ui/Select";
import { Tab, Tabs } from "$app/components/ui/Tabs";
import { Textarea } from "$app/components/ui/Textarea";
import { useReactNativeMessage } from "$app/components/useReactNativeMessage";

type ProfileSettingsTab = "about" | "design" | "pages" | "share";

// How long the user's most recent answer to the unsaved-changes prompt stays reusable for a
// retry of the same navigation. Long enough to absorb a burst of repeated attempts (the bug
// this guards against), short enough that a deliberate second click a few seconds later asks again.
const LEAVE_ANSWER_REUSE_WINDOW_MS = 2000;

// Mirrors SellerProfile::FONT_CHOICES and the after_initialize defaults in app/models/seller_profile.rb.
// The model validates inclusion, so adding a font here without adding it there fails the save.
const DEFAULT_PROFILE_FONT = "ABC Favorit";
const FONT_CHOICES = [DEFAULT_PROFILE_FONT, "Inter", "Domine", "Merriweather", "Roboto Slab", "Roboto Mono"];

// Arrow keys move focus and selection through a group of role="radio" buttons, wrapping at the
// ends. Pair with a roving tabIndex so the group is a single tab stop.
const RADIO_ARROW_STEPS: Record<string, number> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
const selectAdjacentRadio = (event: React.KeyboardEvent<HTMLElement>) => {
  const step = RADIO_ARROW_STEPS[event.key];
  if (step === undefined) return;
  const radios = [...event.currentTarget.querySelectorAll<HTMLButtonElement>("[role=radio]:not(:disabled)")];
  const index = radios.findIndex((radio) => radio === event.target);
  if (index === -1) return;
  event.preventDefault();
  const next = radios[(index + step + radios.length) % radios.length];
  next?.focus();
  next?.click();
};

type ProfilePageProps = {
  profile_settings: ProfileSettingsForm;
  editable_profile: ProfileEditorProps;
  profile_version: string;
  custom_html_pages_enabled: boolean;
  has_custom_landing_page: boolean;
  seller_fonts_css_source: string;
  theme_options: { border_radii: Record<string, string>; button_hover_offsets: Record<string, string> };
  username: string;
  email_confirmation?: EmailConfirmation | null;
} & ProfileProps;

export default function SettingsPage() {
  const { t } = useTranslate();

  const fontDescriptions: Record<string, string> = {
    "ABC Favorit": t("seller.settings.profile.font_quirky"),
    Inter: t("seller.settings.profile.font_simple"),
    Domine: t("seller.settings.profile.font_modern_serif"),
    Merriweather: t("seller.settings.profile.font_sturdy_serif"),
    "Roboto Slab": t("seller.settings.profile.font_personable"),
    "Roboto Mono": t("seller.settings.profile.font_technical"),
  };

  const colorPresets = [
    {
      name: t("seller.settings.profile.color_preset_default"),
      background_color: "#ffffff",
      highlight_color: "#ff90e8",
    },
    {
      name: t("seller.settings.profile.color_preset_black_and_white"),
      background_color: "#ffffff",
      highlight_color: "#000000",
    },
    { name: t("seller.settings.profile.color_preset_dark"), background_color: "#000000", highlight_color: "#ffffff" },
  ];

  const borderRadiusLabels: Record<string, string> = { none: t("seller.settings.profile.square") };
  const {
    creator_profile,
    profile_settings,
    editable_profile,
    profile_version,
    custom_html_pages_enabled,
    has_custom_landing_page,
    seller_fonts_css_source,
    theme_options,
    username,
    email_confirmation,
  } = typia.assert<ProfilePageProps>(usePage().props);
  const loggedInUser = useLoggedInUser();
  const [creatorProfile, setCreatorProfile] = React.useState(creator_profile);
  React.useEffect(() => setCreatorProfile(creator_profile), [creator_profile]);
  const updateCreatorProfile = (newProfile: Partial<CreatorProfile>) =>
    setCreatorProfile((prevProfile) => ({ ...prevProfile, ...newProfile }));
  const [editableProfile, setEditableProfile] = React.useState(editable_profile);
  const lastSavedProfile = React.useRef<ProfileEditorState>({
    sections: editable_profile.sections,
    tabs: editable_profile.tabs,
  });
  const [selectedProfilePageIndex, setSelectedProfilePageIndex] = React.useState(0);
  React.useEffect(() => {
    const previousBaseline = lastSavedProfile.current;
    lastSavedProfile.current = { sections: editable_profile.sections, tabs: editable_profile.tabs };
    setEditableProfile((prevProfile) =>
      isEqual(prevProfile.sections, previousBaseline.sections) && isEqual(prevProfile.tabs, previousBaseline.tabs)
        ? editable_profile
        : prevProfile,
    );
  }, [editable_profile]);
  const handleProfileEditorChange = React.useCallback((updates: ProfileEditorState & { selectedTabIndex: number }) => {
    setSelectedProfilePageIndex(updates.selectedTabIndex);
    setEditableProfile((prevProfile) =>
      isEqual(prevProfile.sections, updates.sections) && isEqual(prevProfile.tabs, updates.tabs)
        ? prevProfile
        : { ...prevProfile, ...updates },
    );
  }, []);
  const previewTabIndex = Math.min(selectedProfilePageIndex, Math.max(editableProfile.tabs.length - 1, 0));
  const selectedPreviewSectionIds = React.useMemo(
    () => new Set(editableProfile.tabs[previewTabIndex]?.sections ?? []),
    [editableProfile.tabs, previewTabIndex],
  );
  const previewSectionCount = editableProfile.sections.filter((section) =>
    selectedPreviewSectionIds.has(section.id),
  ).length;

  const [profileSettings, setProfileSettings] = React.useState(profile_settings);
  const lastSavedSettings = React.useRef(profile_settings);
  React.useEffect(() => {
    const previousBaseline = lastSavedSettings.current;
    lastSavedSettings.current = profile_settings;
    setProfileSettings((current) => rebaseProfileSettings(current, previousBaseline, profile_settings));
  }, [profile_settings]);
  const updateProfileSettings = (newSettings: Partial<ProfileSettingsForm>) =>
    setProfileSettings((prevSettings) => ({ ...prevSettings, ...newSettings }));
  // hide_follow_form must track the live toggle, not the saved profile, so the preview updates before saving.
  const previewCreatorProfile = React.useMemo(
    () => ({ ...creatorProfile, can_edit: false, hide_follow_form: profileSettings.hide_follow_form }),
    [creatorProfile, profileSettings.hide_follow_form],
  );

  const uid = React.useId();
  const [tab, setTab] = React.useState<ProfileSettingsTab>("about");
  const profileUrl = creatorProfile.subdomain ? Routes.root_url({ host: creatorProfile.subdomain }) : Routes.root_url();

  const [isSaving, setIsSaving] = React.useState(false);
  const isEmailConfirmationRequired = email_confirmation != null;
  const canUpdate =
    Boolean(loggedInUser?.policies.settings_profile.update) && !isEmailConfirmationRequired && !isSaving;
  const isDirty =
    !isEqual(profileSettings, lastSavedSettings.current) ||
    !isEqual(editableProfile.sections, lastSavedProfile.current.sections) ||
    !isEqual(editableProfile.tabs, lastSavedProfile.current.tabs);
  const canSave = canUpdate && isDirty;

  const isDirtyRef = React.useRef(isDirty);
  isDirtyRef.current = isDirty;
  // Remembers the user's most recent answer to the unsaved-changes prompt so that a burst of
  // navigation attempts (for example a caller that retries after being blocked, or several visits
  // queued while the dialog was open) reuses that answer instead of opening one dialog per attempt.
  // Without this, sellers saw the same confirm dialog dozens of times in a row. We record which
  // URL the answer was for and only reuse the answer for that same destination: a "leave" grant
  // must not let an unrelated navigation ride on it, and a "stay" refusal must not silently
  // swallow a deliberate click somewhere else — a new destination always prompts again.
  const lastLeaveAnswer = React.useRef<{ time: number; allowed: boolean; href: string } | null>(null);
  React.useEffect(() => {
    const beforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirtyRef.current) e.preventDefault();
    };
    window.addEventListener("beforeunload", beforeUnload);
    const removeInertiaListener = router.on("before", (event) => {
      const visit = event.detail.visit;
      if (!isDirtyRef.current || visit.method !== "get") return;
      // Background requests never discard the editor's local state, so they must not prompt:
      // - prefetch: Inertia warming a link on hover
      // - async: polling-style requests that update props in place (router.reload sets this,
      //   which covers our own post-save reload and the preview refresh)
      // - preserveState visits: the component stays mounted with its state intact
      // Note we intentionally do NOT exempt plain same-path visits: a regular GET to the current
      // path defaults to preserveState: false, so Inertia's React adapter remounts the page with
      // a new key and the pending edits are lost — exactly the loss this prompt protects against.
      if (visit.prefetch || visit.async || visit.preserveState === true) return;
      const previousAnswer = lastLeaveAnswer.current;
      if (
        previousAnswer &&
        Date.now() - previousAnswer.time < LEAVE_ANSWER_REUSE_WINDOW_MS &&
        previousAnswer.href === visit.url.href
      ) {
        // Reuse the answer only for the same destination the user was asked about. A retry of
        // that navigation repeats their choice — "stay" blocks it again silently, "leave" lets it
        // through — while a click to a different destination is a genuinely new navigation and
        // falls through to a fresh prompt.
        if (!previousAnswer.allowed) {
          event.preventDefault();
        }
        return;
      }
      // eslint-disable-next-line no-alert
      const allowed = window.confirm(t("seller.settings.profile.unsaved_changes_confirm"));
      lastLeaveAnswer.current = { time: Date.now(), allowed, href: visit.url.href };
      if (!allowed) event.preventDefault();
    });
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      removeInertiaListener();
    };
  }, []);

  const save = async (): Promise<boolean> => {
    if (!canUpdate) return false;
    setIsSaving(true);
    const settings = profileSettings;
    const previousSettings = lastSavedSettings.current;
    const changedSettings = changedProfileSettings(settings, previousSettings);
    const { sections, tabs } = editableProfile;
    // Only submit pages/sections when they actually changed. A save that left them untouched
    // (e.g. editing just the name or bio) must not resend a now-stale list, or the server would
    // prune sections another tab/device added in the meantime. When they did change, profileVersion
    // lets the server reject the save if the layout changed elsewhere since this editor loaded.
    const profileChanged =
      !isEqual(sections, lastSavedProfile.current.sections) || !isEqual(tabs, lastSavedProfile.current.tabs);
    try {
      await saveProfileSettings({
        ...changedSettings,
        ...(profileChanged ? { tabs, sections, profileVersion: profile_version } : {}),
      });
      lastSavedSettings.current = settings;
      lastSavedProfile.current = { sections, tabs };
      isDirtyRef.current = false;
      await new Promise<void>((resolve) => router.reload({ onFinish: () => resolve() }));
      showAlert(t("seller.settings.profile.changes_saved"), "success");
      return true;
    } catch (e) {
      assertResponseError(e);
      showAlert(e.message, "error");
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const isMobileAppWebView = Boolean(usePage<{ is_mobile_app_web_view?: boolean }>().props.is_mobile_app_web_view);

  useReactNativeMessage((data) => {
    if (data.type === "mobileAppSettingsSave") void save();
  });

  React.useEffect(() => {
    if (!isMobileAppWebView) return;
    postToMobileApp({ type: "settingsCanUpdate", canUpdate: canSave });
  }, [isMobileAppWebView, canSave]);

  // Pin the chosen background too: #ffffff is a saved theme value, not an instruction to inherit
  // the dashboard's colour scheme. The preview must match the buyer-facing stylesheet.
  const profileColors = profileThemeColors(profileSettings.background_color, profileSettings.highlight_color);
  // --radius-sm is derived from --radius on :root, so the preview has to restate it.
  const previewRadius = theme_options.border_radii[profileSettings.border_radius];
  const previewHoverOffset = theme_options.button_hover_offsets[profileSettings.button_hover];
  // Stored six-digit colors keep the case they were saved with; only shorthand is lowercased.
  const selectedColorPreset = colorPresets.find(
    (preset) =>
      preset.background_color === profileSettings.background_color.toLowerCase() &&
      preset.highlight_color === profileSettings.highlight_color.toLowerCase(),
  );

  const customLandingPageActive = custom_html_pages_enabled && has_custom_landing_page;
  const showPagesTab = !customLandingPageActive;
  const showCustomLandingPagePreview = customLandingPageActive && tab !== "design";
  const showThemeWithoutPublicUrl = customLandingPageActive && tab === "design";

  const renderTab = (key: ProfileSettingsTab, label: string) => (
    <Tab
      isSelected={tab === key}
      className="cursor-pointer"
      onClick={() => setTab(key)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          setTab(key);
        }
      }}
      tabIndex={0}
    >
      {label}
    </Tab>
  );

  const tabBar = (
    <Tabs aria-label={t("seller.settings.profile.settings_sections")}>
      {renderTab("about", t("seller.settings.profile.about_tab"))}
      {renderTab("design", t("seller.settings.profile.design_tab"))}
      {showPagesTab ? renderTab("pages", t("seller.settings.profile.pages_tab")) : null}
      {renderTab("share", t("seller.settings.profile.share_tab"))}
    </Tabs>
  );

  const previewSidebar = (
    <PreviewSidebar>
      <PreviewChrome
        title={profileSettings.name || username}
        url={showThemeWithoutPublicUrl ? undefined : profileUrl}
        link={
          showThemeWithoutPublicUrl
            ? undefined
            : (props) => (
                <NavigationButton
                  {...props}
                  disabled={isSaving}
                  href={profileUrl}
                  onClick={(evt) => {
                    evt.preventDefault();
                    // Persist pending edits before previewing, but only when there's something to save -
                    // an unconditional save from a stale, locally-clean tab creates needless writes.
                    if (canSave) {
                      // Open the tab NOW, while we still have the user's click activation, then point it
                      // at the profile once the save finishes. Calling window.open after the await instead
                      // gets popup-blocked on iOS Safari (the async gap consumes the transient activation),
                      // which matters because the mobile preview pane is this button's main audience.
                      // On a failed save, close the reserved tab so we don't surface a stale preview.
                      const previewWindow = window.open("about:blank", "_blank");
                      void save().then((saved) => {
                        if (!saved) previewWindow?.close();
                        else if (previewWindow) previewWindow.location.href = profileUrl;
                        else window.open(profileUrl, "_blank");
                      });
                    } else window.open(profileUrl, "_blank");
                  }}
                />
              )
        }
      >
        {showCustomLandingPagePreview ? (
          <ProfileLandingPagePreview username={username} name={profileSettings.name} bio={profileSettings.bio} />
        ) : (
          <Preview
            scaleFactor={0.4}
            style={{
              fontFamily: profileSettings.font === DEFAULT_PROFILE_FONT ? undefined : profileSettings.font,
              ...profileColors,
              ...(previewRadius !== undefined ? { "--radius": previewRadius, "--radius-sm": previewRadius } : {}),
              ...(previewHoverOffset !== undefined ? { "--button-hover-offset": previewHoverOffset } : {}),
              "--primary": "var(--color)",
              "--body-bg": "rgb(var(--filled))",
              "--contrast-filled": "var(--color)",
              "--color-body": "var(--body-bg)",
              "--color-background": "rgb(var(--filled))",
              "--color-foreground": "rgb(var(--color))",
              "--border-alpha": "1",
              "--color-border": "rgb(var(--color) / var(--border-alpha))",
              "--color-accent": "rgb(var(--accent))",
              "--color-accent-foreground": "rgb(var(--contrast-accent))",
              "--color-accent-with-text": "rgb(var(--accent-with-text))",
              "--color-primary": "rgb(var(--primary))",
              "--color-primary-foreground": "rgb(var(--contrast-primary))",
              "--color-active-bg": "rgb(var(--color) / var(--gray-1))",
              "--color-muted": "rgb(var(--color) / var(--gray-3))",
              backgroundColor: "rgb(var(--filled))",
              color: "rgb(var(--color))",
            }}
          >
            <link rel="preconnect" href="https://fonts.googleapis.com" crossOrigin="anonymous" />
            <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
            <link rel="stylesheet" href={seller_fonts_css_source} />
            <div inert>
              <ProfileLayout
                creatorProfile={previewCreatorProfile}
                hideFollowForm={!previewSectionCount || profileSettings.hide_follow_form}
              >
                <EditProfile
                  {...editableProfile}
                  creator_profile={previewCreatorProfile}
                  bio={profileSettings.bio}
                  controls={false}
                  selectedTabIndex={previewTabIndex}
                />
              </ProfileLayout>
            </div>
          </Preview>
        )}
      </PreviewChrome>
    </PreviewSidebar>
  );

  return (
    <>
      {isMobileAppWebView ? (
        <div className="border-b border-border p-4 md:p-8">{tabBar}</div>
      ) : (
        <PageHeader
          className="sticky-top"
          title={t("seller.settings.profile.profile_settings_title")}
          actions={
            <Button color="accent" onClick={() => void save()} disabled={!canSave}>
              {t("seller.settings.profile.update_profile")}
            </Button>
          }
        >
          {tabBar}
        </PageHeader>
      )}
      <WithPreviewSidebar>
        <div>
          {email_confirmation ? (
            <div className="p-4 pb-0 md:p-8 md:pb-0">
              <EmailConfirmationBanner {...email_confirmation}>
                {email_confirmation.email
                  ? t("seller.settings.profile.confirm_email_before_save", { email: email_confirmation.email })
                  : t("seller.settings.profile.add_and_confirm_email_before_save")}
              </EmailConfirmationBanner>
            </div>
          ) : null}
          {tab === "about" ? (
            <section className="grid gap-8 p-4! md:p-8!">
              <header>
                <h2>{t("seller.settings.profile.about_you")}</h2>
              </header>
              <Fieldset>
                <FieldsetTitle>
                  <Label htmlFor={`${uid}-name`}>{t("seller.settings.profile.name")}</Label>
                </FieldsetTitle>
                <Input
                  id={`${uid}-name`}
                  type="text"
                  value={profileSettings.name ?? ""}
                  disabled={!canUpdate}
                  onChange={(evt) => {
                    updateCreatorProfile({ name: evt.target.value });
                    updateProfileSettings({ name: evt.target.value });
                  }}
                />
              </Fieldset>
              <Fieldset>
                <FieldsetTitle>
                  <Label htmlFor={`${uid}-bio`}>{t("seller.settings.profile.bio")}</Label>
                </FieldsetTitle>
                <Textarea
                  id={`${uid}-bio`}
                  value={profileSettings.bio ?? ""}
                  disabled={!canUpdate}
                  onChange={(e) => updateProfileSettings({ bio: e.target.value })}
                />
              </Fieldset>
              <LogoInput
                logoUrl={creatorProfile.avatar_url}
                onChange={(blob) => {
                  updateCreatorProfile({
                    avatar_url: blob ? Routes.s3_utility_cdn_url_for_blob_path({ key: blob.key }) : "",
                  });
                  updateProfileSettings({ profile_picture_blob_id: blob?.signedId ?? null });
                }}
                disabled={!canUpdate}
              />
              <Fieldset>
                <ToggleSettingRow
                  value={profileSettings.product_page_storefront_enabled}
                  onChange={(value) => updateProfileSettings({ product_page_storefront_enabled: value })}
                  disabled={!canUpdate}
                  label={t("seller.settings.profile.show_storefront_on_product_pages")}
                />
                <FieldsetDescription>{t("seller.settings.profile.show_storefront_desc")}</FieldsetDescription>
              </Fieldset>
              <Fieldset>
                <ToggleSettingRow
                  value={profileSettings.hide_follow_form}
                  onChange={(value) => updateProfileSettings({ hide_follow_form: value })}
                  disabled={!canUpdate}
                  label={t("seller.settings.profile.hide_follow_form")}
                />
                <FieldsetDescription>{t("seller.settings.profile.hide_follow_form_desc")}</FieldsetDescription>
              </Fieldset>
              <Fieldset>
                <FieldsetTitle>
                  <Label htmlFor={`${uid}-locale`}>{t("seller.settings.profile.language")}</Label>
                </FieldsetTitle>
                <Select
                  id={`${uid}-locale`}
                  value={profileSettings.locale ?? "en"}
                  disabled={!canUpdate}
                  onChange={(e) => updateProfileSettings({ locale: e.target.value })}
                >
                  <option value="en">{t("seller.settings.profile.language_english")}</option>
                  <option value="am">{t("seller.settings.profile.language_amharic")}</option>
                </Select>
                <FieldsetDescription>{t("seller.settings.profile.language_desc")}</FieldsetDescription>
              </Fieldset>
            </section>
          ) : tab === "design" ? (
            <section className="grid gap-8 p-4! md:p-8!">
              {customLandingPageActive ? (
                <Alert role="status" variant="info">
                  {t("seller.settings.profile.custom_design_notice", { app_name: "Gumroad" })}
                </Alert>
              ) : null}
              <Fieldset>
                <FieldsetTitle>{t("seller.settings.profile.font")}</FieldsetTitle>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3" role="radiogroup">
                  {FONT_CHOICES.map((font) => {
                    const isSelected = font === profileSettings.font;
                    return (
                      <Button
                        role="radio"
                        key={font}
                        aria-checked={isSelected}
                        onClick={() => updateProfileSettings({ font })}
                        style={{ fontFamily: font === DEFAULT_PROFILE_FONT ? undefined : font }}
                        disabled={!canUpdate}
                        className={classNames(
                          "items-start! justify-start! gap-3! text-left",
                          // Accent outline only for the selected state — no lift or drop shadow
                          // (Sahil, #6233). These cards sit in the dashboard, not the preview, so
                          // --accent here is the fixed dashboard pink and cannot match the border.
                          isSelected && "border-accent! ring-1 ring-accent",
                        )}
                      >
                        <FontFamily className="size-5 shrink-0" />
                        <div>
                          <h4 className="font-bold">{font}</h4>
                          {fontDescriptions[font]}
                        </div>
                      </Button>
                    );
                  })}
                </div>
              </Fieldset>
              <Fieldset>
                <FieldsetTitle>{t("seller.settings.profile.colors")}</FieldsetTitle>
                <div
                  className="grid grid-cols-1 gap-4 sm:grid-cols-3"
                  role="radiogroup"
                  aria-label={t("seller.settings.profile.color_presets_aria")}
                  onKeyDown={selectAdjacentRadio}
                >
                  {colorPresets.map((preset, index) => {
                    const isSelected = preset === selectedColorPreset;
                    // Custom colors match no preset; the first one then takes the group's tab stop.
                    const isTabStop = selectedColorPreset ? isSelected : index === 0;
                    return (
                      <Button
                        role="radio"
                        key={preset.name}
                        aria-checked={isSelected}
                        tabIndex={isTabStop ? 0 : -1}
                        onClick={() =>
                          updateProfileSettings({
                            background_color: preset.background_color,
                            highlight_color: preset.highlight_color,
                          })
                        }
                        disabled={!canUpdate}
                        className={classNames("justify-start!", isSelected && "border-accent! ring-1 ring-accent")}
                      >
                        <span
                          aria-hidden
                          className="size-5 shrink-0 rounded-full border border-border"
                          style={{
                            background: `linear-gradient(135deg, ${preset.background_color} 50%, ${preset.highlight_color} 50%)`,
                          }}
                        />
                        {preset.name}
                      </Button>
                    );
                  })}
                </div>
                <div className="mt-4 grid w-fit grid-cols-[max-content_max-content] gap-y-4">
                  <Label className="col-span-2 grid! grid-cols-subgrid items-center" htmlFor={`${uid}-backgroundColor`}>
                    {t("seller.settings.profile.background_color")}
                    <ColorPicker
                      id={`${uid}-backgroundColor`}
                      value={profileSettings.background_color}
                      onChange={(evt) => updateProfileSettings({ background_color: evt.target.value })}
                      disabled={!canUpdate}
                    />
                  </Label>
                  <Label className="col-span-2 grid! grid-cols-subgrid items-center" htmlFor={`${uid}-highlightColor`}>
                    {t("seller.settings.profile.highlight_color")}
                    <ColorPicker
                      id={`${uid}-highlightColor`}
                      value={profileSettings.highlight_color}
                      onChange={(evt) => updateProfileSettings({ highlight_color: evt.target.value })}
                      disabled={!canUpdate}
                    />
                  </Label>
                </div>
              </Fieldset>
              <Fieldset>
                <FieldsetTitle>{t("seller.settings.profile.corners")}</FieldsetTitle>
                <div
                  className="grid grid-cols-1 gap-4 sm:grid-cols-4"
                  role="radiogroup"
                  aria-label={t("seller.settings.profile.corners")}
                  onKeyDown={selectAdjacentRadio}
                >
                  {Object.entries(theme_options.border_radii).map(([value, radius], index) => {
                    const isSelected = value === profileSettings.border_radius;
                    const isTabStop = previewRadius === undefined ? index === 0 : isSelected;
                    return (
                      <Button
                        role="radio"
                        key={value}
                        aria-checked={isSelected}
                        tabIndex={isTabStop ? 0 : -1}
                        onClick={() => updateProfileSettings({ border_radius: value })}
                        disabled={!canUpdate}
                        className={classNames("justify-start!", isSelected && "border-accent! ring-1 ring-accent")}
                      >
                        <span
                          aria-hidden
                          className="size-5 shrink-0 border-t-2 border-l-2 border-current"
                          style={{ borderTopLeftRadius: radius }}
                        />
                        {borderRadiusLabels[value] ?? capitalize(value)}
                      </Button>
                    );
                  })}
                </div>
              </Fieldset>
              <Fieldset>
                <ToggleSettingRow
                  value={profileSettings.button_hover === "lift"}
                  onChange={(value) => updateProfileSettings({ button_hover: value ? "lift" : "none" })}
                  disabled={!canUpdate}
                  label={t("seller.settings.profile.button_hover_effect")}
                />
                <FieldsetDescription>{t("seller.settings.profile.button_hover_effect_desc")}</FieldsetDescription>
              </Fieldset>
            </section>
          ) : tab === "pages" && showPagesTab ? (
            <>
              <section className="grid gap-8 p-4! md:p-8!">
                <Alert role="status" variant="info">
                  {t("seller.settings.profile.pages_alert_prefix", { app_name: "Gumroad" })}
                  <Link href={Routes.edit_page_path("profile")} className="underline">
                    {t("seller.settings.profile.pages_alert_link")}
                  </Link>
                  {t("seller.settings.profile.pages_alert_suffix")}
                </Alert>
                <AgentSupportFallbackNote subject={t("seller.settings.profile.help_with_profile_page")} />
              </section>
              <section aria-label={t("seller.settings.profile.section_editor")}>
                <ProfileSectionsForm
                  {...editableProfile}
                  creator_profile={creatorProfile}
                  bio={profileSettings.bio}
                  onChange={handleProfileEditorChange}
                  disabled={!canUpdate}
                />
              </section>
            </>
          ) : (
            <section className="grid gap-8 p-4! md:p-8!">
              <header>
                <h2>{t("seller.settings.profile.share_title")}</h2>
              </header>
              <ShareButtons
                url={profileUrl}
                twitterText={t("seller.settings.profile.share_twitter_text", {
                  name: profileSettings.name || username,
                  app_name: "Gumroad",
                })}
                facebookText={profileSettings.name || username}
              />
            </section>
          )}
        </div>
        {previewSidebar}
      </WithPreviewSidebar>
    </>
  );
}
