# frozen_string_literal: true

class AffiliateRequestMailer < ApplicationMailer
  layout "layouts/email"

  default from: "noreply@#{CUSTOMERS_MAIL_DOMAIN}"


  def notify_requester_of_request_submission(affiliate_request_id)
    @affiliate_request = AffiliateRequest.find(affiliate_request_id)
    @requester_has_existing_account = User.exists?(email: @affiliate_request.email)

    with_recipient_locale(@affiliate_request) do
      @subject = t("mailers.affiliate_request.notify_requester_of_request_submission.subject", seller: @affiliate_request.seller.display_name, default: "Your application request to #{@affiliate_request.seller.display_name} was submitted!")
      mail to: @affiliate_request.email,
           subject: @subject,
           delivery_method_options: MailerInfo.random_delivery_method_options(domain: :customers, seller: @affiliate_request.seller, to: @affiliate_request.email)
    end
  end

  def notify_requester_of_request_approval(affiliate_request_id)
    @affiliate_request = AffiliateRequest.find(affiliate_request_id)
    requester = User.find_by!(email: @affiliate_request.email)

    @affiliated_products = requester
      .directly_affiliated_products
      .select("name, custom_permalink, unique_permalink, affiliates.id AS affiliate_id, COALESCE(affiliates_links.affiliate_basis_points, affiliates.affiliate_basis_points) AS basis_points")
      .where(affiliates: { seller_id: @affiliate_request.seller.id })
      .map do |affiliated_product|
        direct_affiliate = DirectAffiliate.new(id: affiliated_product.affiliate_id, affiliate_basis_points: affiliated_product.basis_points)

        {
          name: affiliated_product.name,
          url: direct_affiliate.referral_url_for_product(affiliated_product),
          commission: "#{direct_affiliate.affiliate_percentage}%"
        }
      end

    with_recipient_locale(requester) do
      @subject = t("mailers.affiliate_request.notify_requester_of_request_approval.subject", seller: @affiliate_request.seller.display_name, default: "Your affiliate request to #{@affiliate_request.seller.display_name} was approved!")

      mail to: @affiliate_request.email,
           subject: @subject,
           delivery_method_options: MailerInfo.random_delivery_method_options(domain: :customers, seller: @affiliate_request.seller, to: @affiliate_request.email)
    end
  end

  def notify_requester_of_ignored_request(affiliate_request_id)
    @affiliate_request = AffiliateRequest.find(affiliate_request_id)

    with_recipient_locale(@affiliate_request) do
      @subject = t("mailers.affiliate_request.notify_requester_of_ignored_request.subject", seller: @affiliate_request.seller.display_name, default: "Your affiliate request to #{@affiliate_request.seller.display_name} was not approved")
      mail to: @affiliate_request.email,
           subject: @subject,
           delivery_method_options: MailerInfo.random_delivery_method_options(domain: :customers, seller: @affiliate_request.seller, to: @affiliate_request.email)
    end
  end

  def notify_unregistered_requester_of_request_approval(affiliate_request_id)
    @affiliate_request = AffiliateRequest.find(affiliate_request_id)

    with_recipient_locale(@affiliate_request) do
      @subject = t("mailers.affiliate_request.notify_unregistered_requester_of_request_approval.subject", seller: @affiliate_request.seller.display_name, default: "Your affiliate request to #{@affiliate_request.seller.display_name} was approved!")

      mail to: @affiliate_request.email,
           subject: @subject,
           delivery_method_options: MailerInfo.random_delivery_method_options(domain: :customers, seller: @affiliate_request.seller, to: @affiliate_request.email)
    end
  end

  def notify_seller_of_new_request(affiliate_request_id)
    @affiliate_request = AffiliateRequest.find(affiliate_request_id)

    with_recipient_locale(@affiliate_request.seller) do
      @subject = t("mailers.affiliate_request.notify_seller_of_new_request.subject", name: @affiliate_request.name, default: "#{@affiliate_request.name} has applied to be an affiliate")

      mail to: @affiliate_request.seller.email,
           subject: @subject,
           delivery_method_options: MailerInfo.random_delivery_method_options(domain: :customers, seller: @affiliate_request.seller, to: @affiliate_request.seller.email)
    end
  end
end
