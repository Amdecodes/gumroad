import { Envelope, Instagram, Tiktok, TwitterX, Youtube } from "@boxicons/react";
import * as React from "react";

import {
  approveMarketingAction,
  cancelMarketingAction,
  executeMarketingAction,
  fetchMarketingRecommendations,
  type MarketingAction,
  type MarketingChannel,
} from "$app/data/marketing_actions";
import { formatPriceCentsWithCurrencySymbol } from "$app/utils/currency";
import { useTranslation } from "$app/utils/i18n";
import { assertResponseError } from "$app/utils/request";

import { Button, NavigationButton } from "$app/components/Button";
import { Modal } from "$app/components/Modal";
import { showAlert } from "$app/components/server-components/Alert";
import { TwitterShareButton } from "$app/components/TwitterShareButton";
import { Alert } from "$app/components/ui/Alert";
import { Card, CardContent } from "$app/components/ui/Card";
import { Pill } from "$app/components/ui/Pill";
import { Textarea } from "$app/components/ui/Textarea";

const CHANNEL_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  x: TwitterX,
  instagram: Instagram,
  youtube: Youtube,
  tiktok: Tiktok,
  email: Envelope,
};

// Blast completion records processing by the email provider, not inbox delivery.
const EMAIL_DRAFT_SUMMARY: Record<NonNullable<MarketingChannel["draft"]>["state"], (subject: string) => string> = {
  draft: () => "Launch email drafted for your saved audience.",
  scheduled: (subject) => `Your launch email about ${subject} is scheduled for your audience.`,
  published: (subject) => `Your launch post about ${subject} is published.`,
  sending: (subject) => `Your launch email about ${subject} is being processed. Check delivery details in Emails.`,
  waiting: (subject) =>
    `Your launch email about ${subject} is waiting to be processed. Check delivery details in Emails.`,
  incomplete: (subject) =>
    `Your launch email about ${subject} has not finished processing. Check delivery details in Emails.`,
  sent: (subject) => `Email processing is complete for ${subject}. Check delivery details in Emails.`,
};

const pluralize = (count: number, singular: string, plural: string) => (count === 1 ? singular : plural);

// One line, naming the product once: the card already sits on the product's own page.
const draftSummary = (counts: NonNullable<MarketingChannel["counts"]>) => {
  const segments = [
    `${counts.customers} past ${pluralize(counts.customers, "customer", "customers")}`,
    `${counts.followers} ${pluralize(counts.followers, "follower", "followers")}`,
  ];
  if (counts.affiliates > 0)
    segments.push(`${counts.affiliates} ${pluralize(counts.affiliates, "affiliate", "affiliates")}`);
  return `Launch email drafted for ${counts.total} ${pluralize(counts.total, "person", "people")} (${segments.join(", ")}) in the draft's saved audience.`;
};

const formatUSD = (cents: number) =>
  formatPriceCentsWithCurrencySymbol("usd", cents, { symbolFormat: "short", noCentsIfWhole: true });

export const ShareYourLaunchCard = ({ productPermalink }: { productPermalink: string }) => (
  <LaunchComposer key={productPermalink} productPermalink={productPermalink} />
);

const NetworkIcon = ({ channel }: { channel: string }) => {
  const Icon = { x: TwitterX, instagram: Instagram, youtube: Youtube, tiktok: Tiktok }[channel];
  return Icon ? <Icon className="size-5 shrink-0" aria-hidden="true" /> : null;
};

const LaunchComposer = ({ productPermalink }: { productPermalink: string }) => {
  const { t } = useTranslation();
  const [channels, setChannels] = React.useState<MarketingChannel[] | null>(null);
  const [selectedChannel, setSelectedChannel] = React.useState<string | null>(null);
  const [drafts, setDrafts] = React.useState<Record<string, string>>({});
  const [busy, setBusy] = React.useState(false);
  const destinationId = React.useId();

  React.useEffect(() => {
    let current = true;
    void fetchMarketingRecommendations(productPermalink)
      .then((result) => {
        if (current) setChannels(result);
      })
      .catch((e: unknown) => {
        assertResponseError(e);
        if (current) setChannels([]);
      });
    return () => {
      current = false;
    };
  }, [productPermalink]);

  const liveChannels =
    channels?.filter((channel) => channel.live && channel.action && channel.channel !== "email") ?? [];
  const emailChannel = channels?.find((channel) => channel.channel === "email" && channel.live && channel.action);
  const channel = liveChannels.find((item) => item.channel === selectedChannel) ?? liveChannels[0];
  const action = channel?.action;
  if ((!channel || !action) && !emailChannel) return null;

  return (
    <section className="grid gap-4">
      <header>
        <h2>{t("seller.productEdit.share_launch_title")}</h2>
        <p className="text-muted">{t("seller.productEdit.share_launch_desc")}</p>
      </header>
      <Card>
        {channel && action ? (
          <>
            {liveChannels.length > 1 ? (
              <CardContent details>
                <fieldset>
                  <legend className="mb-2">{t("seller.productEdit.post_to")}</legend>
                  <div className="flex flex-wrap gap-2">
                    {liveChannels.map((item) => (
                      <label key={item.channel} className="cursor-pointer">
                        <input
                          type="radio"
                          name={destinationId}
                          value={item.channel}
                          checked={channel.channel === item.channel}
                          onChange={() => setSelectedChannel(item.channel)}
                          disabled={busy}
                          className="peer sr-only"
                        />
                        <span className="flex min-h-11 items-center gap-2 rounded border border-border px-3 peer-checked:bg-foreground peer-checked:text-background peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent peer-disabled:cursor-not-allowed">
                          <NetworkIcon channel={item.channel} />
                          {item.label}
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              </CardContent>
            ) : null}
            <ChannelComposer
              key={action.id}
              channel={channel}
              action={action}
              copy={drafts[action.id] ?? action.copy}
              onCopyChange={(copy) => setDrafts((previous) => ({ ...previous, [action.id]: copy }))}
              showNetworkName={liveChannels.length === 1}
              productPermalink={productPermalink}
              busy={busy}
              onBusyChange={setBusy}
              onChange={(updatedAction) =>
                setChannels(
                  (previous) =>
                    previous?.map((item) =>
                      item.channel === channel.channel ? { ...item, action: updatedAction } : item,
                    ) ?? null,
                )
              }
            />
          </>
        ) : null}
        {emailChannel ? <EmailChannelRow channel={emailChannel} /> : null}
      </Card>
    </section>
  );
};

const ChannelIcon = ({ channel, className }: { channel: string; className: string }) => {
  const Icon = CHANNEL_ICONS[channel];
  return Icon ? <Icon className={className} /> : null;
};

const EmailChannelRow = ({ channel }: { channel: MarketingChannel }) => {
  const { t } = useTranslation();
  const counts = channel.counts;
  const draft = channel.draft;

  const emailDraftStateLabels: Record<NonNullable<MarketingChannel["draft"]>["state"], string> = {
    draft: t("seller.productEdit.email_draft_state_draft"),
    scheduled: t("seller.productEdit.email_draft_state_scheduled"),
    published: t("seller.productEdit.email_draft_state_published"),
    sending: t("seller.productEdit.email_draft_state_sending"),
    waiting: t("seller.productEdit.email_draft_state_waiting"),
    incomplete: t("seller.productEdit.email_draft_state_incomplete"),
    sent: t("seller.productEdit.email_draft_state_sent"),
  };

  return (
    <CardContent details className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <ChannelIcon channel="email" className="size-6" />
          <span className="font-semibold">{channel.label}</span>
        </div>
        {draft ? <Pill size="small">{emailDraftStateLabels[draft.state]}</Pill> : null}
      </div>

      {channel.eligible === false ? (
        <Alert role="status">
          <span>
            {channel.blocked_reason}
            {channel.requirements &&
            channel.requirements.sales_cents_total < channel.requirements.min_sales_cents_required
              ? ` You're at ${formatUSD(channel.requirements.sales_cents_total)} of ${formatUSD(channel.requirements.min_sales_cents_required)} in sales.`
              : null}
          </span>
        </Alert>
      ) : channel.declined ? (
        <Alert role="status">
          <span>{t("seller.productEdit.email_draft_declined_alert")}</span>
        </Alert>
      ) : draft ? (
        <>
          <span>
            {draft.state === "draft" && counts ? draftSummary(counts) : EMAIL_DRAFT_SUMMARY[draft.state](draft.subject)}
          </span>
          <div className="flex flex-wrap gap-2">
            <NavigationButton href={draft.edit_url}>
              {draft.state === "draft" ? t("seller.productEdit.review_draft") : t("seller.productEdit.open_in_emails")}
            </NavigationButton>
          </div>
        </>
      ) : (
        <Alert role="status">
          <span>{t("seller.productEdit.email_draft_error_alert")}</span>
        </Alert>
      )}
    </CardContent>
  );
};

const ChannelComposer = ({
  channel,
  action,
  productPermalink,
  onChange,
  copy,
  onCopyChange,
  showNetworkName,
  busy,
  onBusyChange,
}: {
  channel: MarketingChannel;
  action: MarketingAction;
  productPermalink: string;
  onChange: (action: MarketingAction) => void;
  copy: string;
  onCopyChange: (copy: string) => void;
  showNetworkName: boolean;
  busy: boolean;
  onBusyChange: (busy: boolean) => void;
}) => {
  const { t } = useTranslation();
  const [confirming, setConfirming] = React.useState(false);
  const [intentUrl, setIntentUrl] = React.useState<string | undefined>(channel.intent_url);
  const edited = copy !== action.copy;
  const terminal = action.status === "posted" || action.status === "failed" || action.status === "cancelled";
  // The read-only banner already explains why posting cannot work yet; the button would only fail.
  // Reconnecting clears the reason and re-enables it.
  const readOnlyToken = action.error_code === "x_write_permission_missing" && channel.connected;

  const run = async (fn: () => Promise<void>) => {
    onBusyChange(true);
    try {
      await fn();
    } catch (e) {
      assertResponseError(e);
      showAlert(e.message, "error");
    } finally {
      onBusyChange(false);
    }
  };

  const confirmAndPost = () =>
    run(async () => {
      const approved = await approveMarketingAction(productPermalink, action.id, edited ? copy : undefined);
      onChange(approved);
      const result = await executeMarketingAction(productPermalink, action.id);
      setIntentUrl(result.intent_url ?? undefined);
      onChange(result.action);
      setConfirming(false);
      if (result.action.status === "posted")
        showAlert(t("seller.productEdit.posted_on", { channel: channel.label }), "success");
    });

  return (
    <CardContent details className="grid gap-4">
      {showNetworkName || (channel.connected && channel.handle) || terminal ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            {showNetworkName ? (
              <>
                <NetworkIcon channel={channel.channel} />
                <span className="font-semibold">{channel.label}</span>
              </>
            ) : null}
            {channel.connected && channel.handle ? (
              <span className="text-muted">{t("seller.productEdit.posting_as", { handle: channel.handle })}</span>
            ) : null}
          </div>
          {action.status === "posted" ? (
            <Pill color="success" size="small">
              {t("seller.productEdit.posted_badge")}
            </Pill>
          ) : action.status === "cancelled" ? (
            <Pill size="small">{t("seller.productEdit.cancelled_badge")}</Pill>
          ) : null}
        </div>
      ) : null}

      {action.status === "posted" ? (
        <Alert role="status" variant="success">
          <div className="flex flex-col justify-between gap-2 sm:flex-row">
            <span>{t("seller.productEdit.post_live_alert")}</span>
            {action.external_url ? (
              <a href={action.external_url} target="_blank" rel="noreferrer">
                {t("seller.productEdit.view_post_on", { channel: channel.label })}
              </a>
            ) : null}
          </div>
        </Alert>
      ) : null}

      {action.error_code === "x_write_permission_missing" && channel.connected ? (
        <Alert role="status" variant="warning">
          <div className="grid gap-2">
            <span>{t("seller.productEdit.x_read_only_alert")}</span>
            <div className="flex flex-wrap gap-2">
              <TwitterShareButton url={action.link_url ?? ""} text={action.copy} />
              <NavigationButton href={channel.connect_path}>
                {t("seller.productEdit.reconnect_channel", { channel: "X" })}
              </NavigationButton>
            </div>
          </div>
        </Alert>
      ) : action.error_code === "x_post_result_unknown" ? (
        <Alert role="status" variant="warning">
          <div className="flex flex-col justify-between gap-2 sm:flex-row">
            <span>{t("seller.productEdit.x_unknown_alert")}</span>
            <TwitterShareButton url={action.link_url ?? ""} text={action.copy} />
          </div>
        </Alert>
      ) : action.status === "failed" ? (
        <Alert role="status" variant="danger">
          <div className="flex flex-col justify-between gap-2 sm:flex-row">
            <span>{t("seller.productEdit.post_failed_alert", { errorCode: action.error_code ?? "" })}</span>
            {channel.channel === "x" ? <TwitterShareButton url={action.link_url ?? ""} text={action.copy} /> : null}
          </div>
        </Alert>
      ) : null}

      {!terminal ? (
        <>
          <fieldset>
            <label htmlFor={`marketing-copy-${action.id}`}>{t("seller.productEdit.post_text")}</label>
            <Textarea
              id={`marketing-copy-${action.id}`}
              value={copy}
              onChange={(e) => onCopyChange(e.target.value)}
              maxLength={255}
              rows={3}
            />
            <small className="text-muted">{t("seller.productEdit.post_text_help")}</small>
          </fieldset>

          {channel.connected ? (
            <div className="flex flex-wrap gap-2">
              <Button
                color="primary"
                disabled={busy || readOnlyToken || copy.trim() === ""}
                onClick={() => setConfirming(true)}
              >
                {t("seller.productEdit.post_on", { channel: channel.label })}
              </Button>
              <Button
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    onChange(await cancelMarketingAction(productPermalink, action.id));
                  })
                }
              >
                {t("seller.productEdit.dismiss")}
              </Button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              {channel.channel === "x" && intentUrl ? (
                <TwitterShareButton url={action.link_url ?? ""} text={copy}>
                  {t("seller.productEdit.continue_on_x")}
                </TwitterShareButton>
              ) : null}
              <a href={channel.connect_path} className="flex min-h-11 items-center">
                {t("seller.productEdit.connect_channel", { channel: channel.label })}
              </a>
            </div>
          )}
        </>
      ) : null}

      {confirming ? (
        <Modal
          open
          onClose={() => {
            if (!busy) setConfirming(false);
          }}
          allowClose={!busy}
          title={t("seller.productEdit.confirm_post_modal_title", { channel: channel.label })}
          footer={
            <>
              <Button disabled={busy} onClick={() => setConfirming(false)}>
                {t("seller.products.cancel")}
              </Button>
              <Button color="primary" disabled={busy} onClick={() => void confirmAndPost()}>
                {busy ? t("seller.productEdit.posting") : t("seller.productEdit.post_now")}
              </Button>
            </>
          }
        >
          <div className="grid gap-3">
            <p>{t("seller.productEdit.confirm_post_modal_desc", { handle: channel.handle ?? "" })}</p>
            <blockquote className="rounded border border-border p-3 whitespace-pre-wrap">
              {copy}
              {"\n\n"}
              {action.link_url}
            </blockquote>
          </div>
        </Modal>
      ) : null}
    </CardContent>
  );
};
