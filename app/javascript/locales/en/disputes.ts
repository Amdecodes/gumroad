export const disputes = {
  title: "Dispute evidence",
  submit_additional_info: "Submit additional information",
  customer_disputed_multiple:
    "A customer of yours ({email}) has disputed their purchase made on {date} of the following {count} items for {amount}:",
  customer_disputed_single:
    "A customer of yours ({email}) has disputed their purchase made on {date} of {product} for {amount}:",
  deadline_note:
    "Our payment processor accepts one submission per dispute, so we hold your response and send it at the deadline. Come back any time before then to add files or revise what you wrote — after the deadline nothing more can be added, not even by contacting support.",
  saved_response_note:
    "Your saved response is filled in below. Change whatever you want and save again — saving replaces the fields you fill in and leaves the rest as they are.",
  why_win: "Why should you win this dispute?",
  why_sub_not_cancelled: "Why was the customer's subscription not canceled?",
  why_not_entitled_refund: "Why is the customer not entitled to a refund?",
  additional_evidence_prompt: "Do you have additional evidence you'd like to provide?",
  upload_communication: "Upload customer communication",
  upload_help:
    "Any communication with the customer that you feel is relevant to your case (emails, chats, etc. proving that they received the product or service, or screenshots demonstrating their use of or satisfaction with the product or service). You can attach up to {maxFiles} JPG, PNG, or PDF files, each under {maxSize}MB. We combine them into a single PDF in the order shown, so pick them in the order you want them read.",
  save_response: "Save response",
  confirm_save_title: "Save your response?",
  confirm_and_save: "Confirm and save",
  deadline_reminder:
    "We send this to our payment processor at the deadline, not now, so you can come back and add to it until then.",
  attaching_files: {
    one: "You are attaching {count} file, in addition to the file you already saved.",
    other: "You are attaching {count} files, in addition to the file you already saved.",
  },
  saved_file_stays: "Your previously saved file stays attached. You can add more here any time before the deadline.",
  no_files_attached: "You have not attached any files. You can add them here any time before the deadline.",
  saved_success: "Thank you! We've saved your response.",
  sent_at_deadline:
    "We send it to our payment processor at the deadline. Until then you can come back and add files or revise what you wrote.",
  sent_at_deadline_date:
    "We send it to our payment processor at the deadline, {date}. Until then you can come back and add files or revise what you wrote.",
  add_to_response: "Add to your response",
} as const;
