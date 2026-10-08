# frozen_string_literal: true

require "spec_helper"
require "shared_examples/authorize_called"

describe("Main Settings Scenario", type: :system, js: true) do
  let(:user) { create(:user, name: "Gum") }

  before do
    login_as user
  end

  describe "sub navigation" do
    it "displays main, payments, and password sections without advanced" do
      visit settings_main_path

      expect(page).to have_tab_button "Settings"
      expect(page).to have_tab_button "Payments"
      expect(page).to have_tab_button "Password and authentication"
      expect(page).not_to have_tab_button "Advanced"
    end
  end

  context "when email is present" do
    it "allows user to update settings" do
      visit settings_main_path
      new_email = "k@gumroad.com"
      within_section "User details", section_element: :section do
        fill_in("Email", with: new_email)
      end
      click_on("Update settings")

      expect(page).to have_alert(text: "Your account has been updated!")
      expect(user.reload.unconfirmed_email).to eq new_email
    end

    it "normalizes input and saves the username" do
      visit settings_main_path
      raw_username = "Katsuya 123 !@#"
      normalized_username = "katsuya123"
      within_section "User details", section_element: :section do
        expect(page).to have_link(user.subdomain, href: user.subdomain_with_protocol)
        fill_in("Username", with: raw_username)
        new_subdomain = Subdomain.from_username(normalized_username)
        expect(page).to have_link(new_subdomain, href: "#{PROTOCOL}://#{new_subdomain}")
      end
      click_on("Update settings")
      expect(page).to have_alert(text: "Your account has been updated!")
      expect(user.reload.username).to eq normalized_username
    end
  end

  context "when email is empty" do
    it "shows a validation error on save" do
      visit settings_main_path

      within_section "User details", section_element: :section do
        fill_in("Email", with: "")
      end

      click_on("Update settings")

      within_section "User details", section_element: :section do
        validation_message = find_field("Email").native.attribute("validationMessage")
        expect(validation_message).to eq "Please fill out this field."
      end
    end
  end

  describe "Unconfirmed email" do
    context "when email is verified" do
      it "doesn't show resend link" do
        visit settings_main_path

        within_section "User details", section_element: :section do
          expect(find_field("Email").value).to eq user.email
        end
        expect(page).to_not have_link("Resend confirmation?")
      end
    end

    context "when email is not verified" do
      before do
        user.update!(email: "n00b@gumroad.com")
      end

      it "allows resending email confirmation" do
        visit settings_main_path

        within_section "User details", section_element: :section do
          expect(find_field("Email").value).to eq "n00b@gumroad.com"
        end
        expect(page).to have_text("This email address has not been confirmed yet. Resend confirmation?")
        click_on "Resend confirmation?"

        expect(page).to have_alert(text: "Confirmation email resent!")
        expect(page).to_not have_link("Resend confirmation?")
      end

      # "Resend confirmation?" is the only button inside this <form>. While it was a bare <button>
      # with no type it defaulted to submit, which made it the form's default button: Enter in the
      # email field resent the confirmation instead of doing nothing. LinkButton pins type="button".
      it "does not resend the confirmation email when the seller presses Enter in the email field" do
        visit settings_main_path

        expect(page).to have_button("Resend confirmation?")
        within_section "User details", section_element: :section do
          find_field("Email").send_keys(:enter)
        end

        expect(page).to have_button("Resend confirmation?")
        expect(page).to_not have_alert(text: "Confirmation email resent!")
      end
    end
  end

  context "when logged user has role admin" do
    let(:seller) { create(:named_seller) }

    include_context "with switching account to user as admin for seller"

    it "disables the form" do
      visit settings_main_path
      expect(page).not_to have_link("Password and authentication")
      expect(page).not_to have_button("Update settings")
      expect(page).not_to have_selector(".js-invalidate-active-sessions-trigger", text: "Sign out from all active sessions")
    end
  end

  describe "single currency ETB setting" do
    it "shows ETB single currency notice and hides PPP" do
      visit settings_main_path

      expect(page).to have_text("All products, purchases, and creator payouts are processed in ETB.")
      expect(page).not_to have_text("Enable purchasing power parity")
    end
  end

  it "allows the user to disable review notifications" do
    visit settings_main_path
    uncheck "Reviews", checked: true
    click_on "Update settings"
    expect(page).to have_alert(text: "Your account has been updated!")
    expect(user.reload.disable_reviews_email).to eq(true)

    visit settings_main_path
    check "Reviews", unchecked: true
    click_on "Update settings"
    expect(page).to have_alert(text: "Your account has been updated!")
    expect(user.reload.disable_reviews_email).to eq(false)
  end

  it "allows the user to toggle showing NSFW products" do
    visit settings_main_path

    expect(user.show_nsfw_products).to eq(false)
    expect(page).to have_unchecked_field("Show adult content in recommendations and search results")

    check "Show adult content in recommendations and search results"
    click_on "Update settings"

    expect(page).to have_alert(text: "Your account has been updated!")
    expect(user.reload.show_nsfw_products).to eq(true)

    visit settings_main_path
    expect(page).to have_checked_field("Show adult content in recommendations and search results")

    uncheck "Show adult content in recommendations and search results"
    click_on "Update settings"

    expect(page).to have_alert(text: "Your account has been updated!")
    expect(user.reload.show_nsfw_products).to eq(false)
  end

  describe "Refund policy" do
    context "when the refund policy is enabled" do
      before do
        user.update!(refund_policy_enabled: true)
        user.refund_policy.update!(max_refund_period_in_days: 0)
      end

      it "allows the user to update the refund policy" do
        visit settings_main_path
        expect(page).to have_field("Add a fine print to your refund policy", disabled: true)

        select "30-day money back guarantee", from: "Refund period"
        check "Add a fine print to your refund policy"
        fill_in "Fine print", with: "This is a sample fine print"

        click_on "Update settings"

        expect(page).to have_alert(text: "Your account has been updated!")

        refund_policy = user.refund_policy.reload
        expect(refund_policy.max_refund_period_in_days).to eq(30)
        expect(refund_policy.fine_print).to eq("This is a sample fine print")
      end
    end

    context "when the refund policy is disabled" do
      it "does not allow the user to update the refund policy" do
        visit settings_main_path
        expect(page).to_not have_field("Refund policy")
      end
    end
  end

  context "Support email fallback" do
    # An unset support_email used to render the account email as the input's
    # placeholder, so "empty, falling back" looked identical to "explicitly set".
    it "names the account email in the description and leaves the field visibly empty" do
      visit settings_main_path

      within_section "Support", section_element: :section do
        field = find_field("Email")
        expect(field.value).to eq("")
        expect(field["placeholder"]).to eq("you@example.com")
        expect(page).to have_text("Leave blank to use your account email (#{user.email}).")
      end
    end

    it "keeps the fallback hint visible once a support email is set" do
      user.update!(support_email: "support@example.com")

      visit settings_main_path

      within_section "Support", section_element: :section do
        expect(find_field("Email").value).to eq("support@example.com")
        expect(page).to have_text("Leave blank to use your account email (#{user.email}).")
      end
    end
  end

  context "Product level support email" do
    let!(:product_1) { create(:product, user:, name: "Product 1", support_email: email_1) }
    let!(:product_2) { create(:product, user:, name: "Product 2", support_email: nil) }

    let(:email_1) { "support1@example.com" }
    let(:email_2) { "support2@example.com" }
    let(:email_3) { "support3@example.com" }

    it "allows adding new support emails" do
      visit settings_main_path

      click_on "Add a product specific email"

      within find_product_level_support_email_row(name: "No email set") do
        fill_in "Email", with: email_2
        select_combo_box_option "Product 2", from: "Products"
      end

      click_on "Update settings"

      expect(page).to have_alert(text: "Your account has been updated!")
      expect(product_1.reload.support_email).to eq email_1
      expect(product_2.reload.support_email).to eq email_2
    end

    it "allows deleting support email" do
      visit settings_main_path

      within find_product_level_support_email_row(name: email_1) do
        click_on "Delete email"
      end

      click_on "Update settings"

      expect(page).to have_alert(text: "Your account has been updated!")
      expect(product_1.reload.support_email).to be_nil
      expect(product_2.reload.support_email).to be_nil
    end

    it "does not allow same product to be selected for multiple emails" do
      visit settings_main_path

      click_on "Add a product specific email"

      within find_product_level_support_email_row(name: "No email set") do
        find(:label, text: "Products").click
        # Product 1 is not available because it already has an email.
        expect(page).to have_combo_box "Products", options: ["Product 2"]
      end
    end
  end

  def find_product_level_support_email_row(name:)
    find("[role=listitem] h4", text: name).ancestor("[role=listitem]")
  end
end
