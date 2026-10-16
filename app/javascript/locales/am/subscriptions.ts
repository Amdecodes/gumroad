export const subscriptions = {
  statuses: {
    active: "ንቁ",
    renewal_due: "የዕድሳት ጊዜ ደርሷል",
    in_grace_period: "የማራዘሚያ ጊዜ",
    past_due: "ጊዜው ያለፈበት",
    cancelled: "የተሰረዘ",
    expired: "አብቅቷል",
  },
  renewal_banner_title: "የምዝገባ ዕድሳት ደርሷል",
  grace_period_warning: "ምዝገባዎ በማራዘሚያ ጊዜ ውስጥ ነው (ቀሪ {days} ቀናት)። ያልተቋረጠ መዳረሻ ለማግኘት አሁኑኑ ያድሱ።",
  renew_now_for: "በ{price} አሁኑኑ ያድሱ",
  renewal_success: "ምዝገባው እስከ {date} በተሳካ ሁኔታ ታድሷል።",
  gift_paid_until: "የእርስዎ {entity} እስከ {date} ድረስ ተከፍሏል። የእርስዎ {entity} መታደሱን ለማረጋገጥ የራስዎን የክፍያ ዘዴ ከታች ያክሉ።",
  renewals_paused_notice: "ራስ-ሰር እድሳት ቆሟል። እስከዚያው መዳረሻ ይኖርዎታል፤ ለመቀጠል የክፍያ ዘዴዎን ከታች ያዘምኑ።",
} as const;
