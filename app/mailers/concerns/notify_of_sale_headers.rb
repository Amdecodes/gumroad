# frozen_string_literal: true

module NotifyOfSaleHeaders
  extend ActiveSupport::Concern

  def set_notify_of_sale_headers(is_preorder:)
    formatted_price = @price || @purchase.try(:formatted_total_price)
    if @product.is_recurring_billing
      if @purchase.try(:is_upgrade_purchase)
        @mail_heading = @subject = t("mailers.contacting_creator.notify.subject_upgrade", product: @product.name, price: formatted_price, default: "A subscriber has upgraded their subscription for #{@product.name} and was charged #{formatted_price}")
      elsif @purchase.try(:is_recurring_subscription_charge)
        @mail_heading = @subject = t("mailers.contacting_creator.notify.subject_recurring_charge", product: @product.name, price: formatted_price, default: "New recurring charge for #{@product.name} of #{formatted_price}")
      else
        @mail_heading = @subject = t("mailers.contacting_creator.notify.subject_subscriber", product: @product.name, price: formatted_price, default: "You have a new subscriber for #{@product.name} of #{formatted_price}")
      end
    elsif is_preorder
      @mail_heading = @subject = t("mailers.contacting_creator.notify.subject_preorder_price", product: @product.name, price: formatted_price, default: "New pre-order of #{@product.name} for #{formatted_price}")
    elsif @purchase.present? && @purchase.price_cents == 0 && !@product.is_physical
      @mail_heading = @subject = t("mailers.contacting_creator.notify.subject_download", product: @product.name, default: "New download of #{@product.name}")
    else
      @mail_heading = t("mailers.contacting_creator.notify.mail_heading_sale", default: "You made a sale!")

      if formatted_price.present?
        @subject = t("mailers.contacting_creator.notify.subject_sale_price", product: @product.name, price: formatted_price, default: "New sale of #{@product.name} for #{formatted_price}")
      else
        @subject = t("mailers.contacting_creator.notify.subject_sale_no_price", product: @product.name, default: "New sale of #{@product.name}")
      end
    end

    @mail_subheading = \
      if @purchase&.recommended_by == RecommendationType::GUMROAD_STAFF_PICKS_RECOMMENDATION
        "via Staff picks in <a href=\"#{UrlService.discover_domain_with_protocol}\" target=\"_blank\">Discover</a>".html_safe
      elsif @purchase&.recommended_by == RecommendationType::GUMROAD_MORE_LIKE_THIS_RECOMMENDATION
        "via More like this recommendations"
      elsif @purchase.try(:was_discover_fee_charged)
        "via <a href=\"#{UrlService.discover_domain_with_protocol}\" target=\"_blank\">Discover</a>".html_safe
      end
  end
end
