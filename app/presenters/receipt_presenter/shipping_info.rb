# frozen_string_literal: true

class ReceiptPresenter::ShippingInfo
  include ActionView::Helpers::TextHelper
  include CurrencyHelper

  def initialize(chargeable)
    @chargeable = chargeable
  end

  def title
    I18n.t("checkout.shipping_information", default: "Shipping info")
  end

  def attributes
    return [] unless chargeable.require_shipping?

    [
      to_attribute,
      address_attribute
    ]
  end

  def present?
    attributes.present?
  end

  private
    attr_reader :chargeable

    def to_attribute
      {
        label: I18n.t("mailers.customer.receipt.shipping_to", default: "Shipping to"),
        value: chargeable.full_name,
      }
    end

    def address_attribute
      {
        label: I18n.t("checkout.shipping_information", default: "Shipping address"),
        value: safe_join(
          [
            chargeable.street_address,
            "#{ chargeable.city }, #{ chargeable.state } #{ chargeable.zip_code }",
            chargeable.country
          ],
          tag.br
        ),
      }
    end
end
