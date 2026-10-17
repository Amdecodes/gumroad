export const library = {
  title: "Library",
  purchases: "Purchases",
  saved: "Saved",
  following: "Following",
  reviews: "Reviews",

  // Card actions
  archive: "Archive",
  unarchive: "Unarchive",
  product_archived: "Product archived!",
  product_unarchived: "Product unarchived!",
  remove_from_library: "Remove from library",
  removed_from_library: "Removed from your library!",
  remove_confirm_title: "Remove {name} from your library?",
  remove_confirm_desc:
    "You keep access through your original download link, and our support team can put the card back if you change your mind.",

  // Empty states & notices
  empty_header: "You haven't bought anything... yet!",
  empty_desc: "Once you do, it'll show up here so you can download, watch, read, or listen to all your purchases.",
  discover_products: "Discover products",
  all_archived_header: "You've archived all your products.",
  see_archive: "See archive",
  archived_notice: {
    one: "You have {count} archived purchase. {click_here}",
    other: "You have {count} archived purchases. {click_here}",
  },
  click_here_to_view: "Click here to view",

  // Filters & sorting
  showing_products: "Showing {from}-{to} of {count} products",
  no_products_found: "No products found",
  search_products: "Search products",
  sort_by: "Sort by",
  recently_updated: "Recently Updated",
  purchase_date: "Purchase Date",
  bundles: "Bundles",
  creator: "Creator",
  all_creators: "All Creators",
  show_more: "Show more",
  show_archived_only: "Show archived only",

  // Bundle downloads
  bundle_too_large: "{label} is too large to download as one ZIP file. Download the products below individually.",
  bundle_failed: "We could not prepare a ZIP file for {label}. Download the products below individually.",
  bundle_download_all_zip: "Download everything included in {label} as one ZIP file.",
  download_all: "Download all",
  preparing_zip: "Preparing ZIP",
  purchase_successful_receipt_sent: "Your purchase was successful! We sent a receipt to {email}.",
  removing: "Removing...",
  remove_modal_body:
    "You keep access through this page's link, and our support team can put the card back if you change your mind.",
} as const;
