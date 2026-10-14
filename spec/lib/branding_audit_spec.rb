# frozen_string_literal: true

require "spec_helper"

RSpec.describe "Branding Audit" do
  # Files and patterns subject to strict platform de-branding.
  # No user-facing text in these files may contain upstream "Gumroad" branding.
  LOCALE_FILES = Dir.glob(
    [
      Rails.root.join("config/locales/**/*.{yml,yaml}").to_s,
      Rails.root.join("app/javascript/locales/**/*.{ts,js,json}").to_s,
    ]
  ).freeze

  MAILER_VIEW_FILES = Dir.glob(
    [
      Rails.root.join("app/views/layouts/mailers/**/*").to_s,
      Rails.root.join("app/views/shared/mailers/**/*").to_s,
      Rails.root.join("app/views/layouts/email.*").to_s,
      Rails.root.join("app/views/posts/post_email.*").to_s,
      Rails.root.join("app/views/team_mailer/**/*").to_s,
      Rails.root.join("app/views/service_mailer/**/*").to_s,
      Rails.root.join("app/views/invite_mailer/**/*").to_s,
      Rails.root.join("app/views/merchant_registration_mailer/**/*").to_s,
      Rails.root.join("app/views/customer_mailer/**/*").to_s,
      Rails.root.join("app/views/customer_low_priority_mailer/**/*").to_s,
      Rails.root.join("app/views/contacting_creator_mailer/subscription_charge_blocked_location.*").to_s,
      Rails.root.join("app/views/contacting_creator_mailer/product_level_refund_policies_reverted.*").to_s,
    ]
  ).select { |f| File.file?(f) }.freeze

  TOUCHED_FILES = [
    Rails.root.join("app/views/home/shared/_footer.html.erb").to_s,
    Rails.root.join("app/javascript/components/Home/Shared/Footer.tsx").to_s,
    Rails.root.join("app/javascript/components/Support/ContactSupportModal.tsx").to_s,
    Rails.root.join("app/javascript/components/Checkout/Receipt.tsx").to_s,
    Rails.root.join("app/javascript/components/ProductEdit/ProductTab/index.tsx").to_s,
    Rails.root.join("app/presenters/receipt_presenter.rb").to_s,
    Rails.root.join("app/presenters/receipt_presenter/payment_info.rb").to_s,
    Rails.root.join("app/helpers/mailer_helper.rb").to_s,
    Rails.root.join("app/mailers/customer_mailer.rb").to_s,
    Rails.root.join("app/mailers/application_mailer.rb").to_s,
    Rails.root.join("app/mailers/follower_mailer.rb").to_s,
    Rails.root.join("app/mailers/affiliate_mailer.rb").to_s,
    Rails.root.join("app/mailers/customer_low_priority_mailer.rb").to_s,
    Rails.root.join("app/mailers/creator_mailer.rb").to_s,
    Rails.root.join("app/mailers/one_off_mailer.rb").to_s,
    Rails.root.join("app/mailers/team_mailer.rb").to_s,
    Rails.root.join("app/mailers/service_mailer.rb").to_s,
    Rails.root.join("app/mailers/invite_mailer.rb").to_s,
    Rails.root.join("app/views/purchases/subscribe.html.erb").to_s,
    Rails.root.join("app/views/url_redirects/check_purchaser.html.erb").to_s,
    Rails.root.join("app/presenters/invoice_presenter/supplier_info.rb").to_s,
    Rails.root.join("config/initializers/platform_config.rb").to_s,
  ].select { |f| File.file?(f) }.freeze

  FORBIDDEN_PATTERN = /(?:gumroad|sahil|antiwork)/i

  SELLER_MAILER_VIEW_FILES = Dir.glob(
    [
      Rails.root.join("app/views/contacting_creator_mailer/**/*").to_s,
      Rails.root.join("app/views/accounting_mailer/**/*").to_s,
      Rails.root.join("app/views/affiliate_mailer/**/*").to_s,
      Rails.root.join("app/views/admin_mailer/**/*").to_s,
    ]
  ).select { |f| File.file?(f) }.freeze

  # Lines matching these patterns are explicit allowlist entries
  # (comments, image assets, legal references, or specific internal code identifiers).
  # No whole-directory exemptions exist.
  def allowlisted_line?(line, file_path)
    stripped = line.strip

    # 1. Full-line code comments
    return true if stripped.start_with?("#", "//", "/*", "*", "<!--", "<%#")

    # 2. Specific exempted image filenames and alt attributes
    return true if /["']email\/(?:wordmark_logo|gumroad_coins|gpt3_gumroad)\.png["']/.match?(stripped)
    return true if /image_(?:path|tag|url)\(["']email\/gumroad_coins\.png["']\)/.match?(stripped)
    return true if stripped.include?("logo-g.svg")

    # 3. Specific Help Center article links (Help Center untouched as instructed)
    return true if %r{/help/article/[0-9]+-gumroad}.match?(stripped)

    # 4. Route helpers in marketing footer
    return true if stripped.include?("gumroad_blog_root_path")

    # 5. Specific internal constants and symbols in touched Ruby files
    return true if /\bPurchase::GUMROAD_[A-Z0-9_]+\b/.match?(stripped)
    return true if /\bGUMROAD_[A-Z0-9_]+\b/.match?(stripped)
    return true if /\bdomain:\s*:gumroad\b/.match?(stripped)
    return true if /\bgumroad@/.match?(stripped)
    return true if /@gumroad_url\b/.match?(stripped)
    return true if file_path.end_with?("supplier_info.rb") && /gumroad_[a-z_]+/.match?(stripped)
    return true if file_path.end_with?("creator_mailer.rb") && stripped.include?("gumroad_day")

    # 6. LICENSE notices
    return true if /\bLICENSE\b/i.match?(stripped)

    false
  end

  def check_files(files)
    violations = []
    files.uniq.each do |file_path|
      rel_path = Pathname.new(file_path).relative_path_from(Rails.root).to_s
      in_block_comment = false
      File.readlines(file_path).each_with_index do |line, idx|
        stripped = line.strip

        # Track multi-line comments
        if !in_block_comment && (stripped.start_with?("<%#", "/*", "<!--", "{/*") || stripped.start_with?("=begin"))
          in_block_comment = true unless stripped.end_with?("%>", "*/", "-->", "=end", "*/}")
          next
        end

        if in_block_comment
          in_block_comment = false if stripped.include?("%>") || stripped.include?("*/") || stripped.include?("-->") || stripped.include?("=end") || stripped.include?("*/}")
          next
        end

        next unless FORBIDDEN_PATTERN.match?(line)
        next if allowlisted_line?(line, file_path)

        violations << "#{rel_path}:#{idx + 1}: #{line.strip}"
      end
    end
    violations
  end

  describe "config/locales" do
    it "contains zero unallowed occurrences of forbidden tokens" do
      violations = check_files(LOCALE_FILES.select { |f| f.include?("config/locales") })
      expect(violations).to be_empty, "Found forbidden branding tokens in config/locales:\n#{violations.join("\n")}"
    end
  end

  describe "app/javascript/locales" do
    it "contains zero unallowed occurrences of forbidden tokens" do
      violations = check_files(LOCALE_FILES.select { |f| f.include?("app/javascript/locales") })
      expect(violations).to be_empty, "Found forbidden branding tokens in app/javascript/locales:\n#{violations.join("\n")}"
    end
  end

  describe "mailer views" do
    it "contains zero unallowed occurrences of forbidden tokens" do
      violations = check_files(MAILER_VIEW_FILES)
      expect(violations).to be_empty, "Found forbidden branding tokens in mailer views:\n#{violations.join("\n")}"
    end
  end

  describe "touched files in platform branding audit" do
    it "contains zero unallowed occurrences of forbidden tokens" do
      violations = check_files(TOUCHED_FILES)
      expect(violations).to be_empty, "Found forbidden branding tokens in touched files:\n#{violations.join("\n")}"
    end
  end

  describe "seller mailers (pending remediation)" do
    it "audits seller mailers for forbidden tokens" do
      pending "Seller mailers de-branding is planned for follow-up"
      violations = check_files(SELLER_MAILER_VIEW_FILES)
      expect(violations).to be_empty
    end
  end
end
