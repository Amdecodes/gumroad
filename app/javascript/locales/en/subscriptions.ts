export const subscriptions = {
  statuses: {
    active: "Active",
    renewal_due: "Renewal Due",
    in_grace_period: "Grace Period",
    past_due: "Past Due",
    cancelled: "Cancelled",
    expired: "Expired",
  },
  renewal_banner_title: "Subscription Renewal Due",
  grace_period_warning:
    "Your membership is in its grace period ({days} days remaining). Renew now to maintain uninterrupted access.",
  renew_now_for: "Renew now for {price}",
  renewal_success: "Subscription successfully renewed until {date}.",
} as const;
