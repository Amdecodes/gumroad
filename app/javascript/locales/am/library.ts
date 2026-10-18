export const library = {
  title: "ቤተ-መጽሐፍት",
  purchases: "ግዢዎች",
  saved: "የተቀመጡ",
  following: "የምከተላቸው",
  reviews: "ግምገማዎች",

  // Card actions
  archive: "ወደ ማህደር አስቀምጥ",
  unarchive: "ከማህደር አውጣ",
  product_archived: "ምርቱ ወደ ማህደር ተቀምጧል!",
  product_unarchived: "ምርቱ ከማህደር ወጥቷል!",
  remove_from_library: "ከቤተ-መጽሐፍት አስወግድ",
  removed_from_library: "ከቤተ-መጽሐፍትዎ ተወግዷል!",
  remove_confirm_title: "{name} ከቤተ-መጽሐፍትዎ ይወገድ?",
  remove_confirm_desc: "በመጀመሪያው የማውረጃ አገናኝዎ በኩል መዳረሻ ይኖርዎታል፣ እና ሀሳብዎን ከቀየሩ የድጋፍ ቡድናችን ካርዱን ሊመልስልዎ ይችላል።",

  // Empty states & notices
  empty_header: "እስካሁን ምንም አልገዙም!",
  empty_desc: "አንዴ ከገዙ፣ ሁሉንም ግዢዎችዎን ማውረድ፣ መመልከት፣ ማንበብ ወይም ማዳመጥ እንዲችሉ እዚህ ይታያሉ።",
  discover_products: "ምርቶችን ያስሱ",
  all_archived_header: "ሁሉንም ምርቶችዎን ወደ ማህደር አስቀምጠዋል።",
  see_archive: "ማህደርን ይመልከቱ",
  archived_notice: {
    one: "{count} በማህደር የተቀመጠ ግዢ አለዎት። {click_here}",
    other: "{count} በማህደር የተቀመጡ ግዢዎች አሉዎት። {click_here}",
  },
  click_here_to_view: "ለመመልከት እዚህ ጠቅ ያድርጉ",

  // Filters & sorting
  showing_products: "ከ{count} ምርቶች ውስጥ {from}-{to} በማሳየት ላይ",
  no_products_found: "ምንም ምርት አልተገኘም",
  search_products: "ምርቶችን ይፈልጉ",
  sort_by: "ደርድር በ",
  recently_updated: "በቅርቡ የተሻሻለ",
  purchase_date: "የተገዛበት ቀን",
  bundles: "ጥቅሎች",
  creator: "ሻጭ",
  all_creators: "ሁሉም ሻጮች",
  show_more: "ተጨማሪ አሳይ",
  show_archived_only: "በማህደር የተቀመጡትን ብቻ አሳይ",

  // Bundle downloads
  bundle_too_large: "{label} እንደ አንድ የዚፕ (ZIP) ፋይል ለማውረድ በጣም ትልቅ ነው። እባክዎ ከታች ያሉትን ምርቶች በተናጠል ያውርዱ።",
  bundle_failed: "ለ{label} የዚፕ (ZIP) ፋይል ማዘጋጀት አልተቻለም። እባክዎ ከታች ያሉትን ምርቶች በተናጠል ያውርዱ።",
  bundle_download_all_zip: "በ{label} ውስጥ የተካተቱትን ሁሉ እንደ አንድ የዚፕ (ZIP) ፋይል ያውርዱ።",
  download_all: "ሁሉንም ያውርዱ",
  preparing_zip: "ዚፕ (ZIP) በማዘጋጀት ላይ",
  purchase_successful_receipt_sent: "ግዢዎ በተሳካ ሁኔታ ተጠናቋል! ደረሰኝ ወደ {email} ልከናል!",
  removing: "በማስወገድ ላይ...",
  remove_modal_body: "በዚህ ገጽ አገናኝ በኩል መዳረሻዎ እንዳለ ይቆያል፣ እና ሀሳብዎን ከቀየሩ የድጋፍ ቡድናችን ካርዱን መልሶ ማስቀመጥ ይችላል።",
  open_product_action_menu: "የምርት እርምጃ ሜኑ ክፈት",
} as const;
