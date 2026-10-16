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
  gift_paid_until:
    "Your {entity} is paid up until {date}. Add your own payment method below to ensure that your {entity} renews.",
  renewals_paused_notice:
    "Automatic renewals are paused. You keep access in the meantime; update your payment method below to resume.",
} as const;
