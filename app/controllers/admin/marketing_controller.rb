# frozen_string_literal: true

class Admin::MarketingController < Admin::BaseController
  include CurrencyHelper

  layout "inertia"

  def index
    active_tab = params[:tab].presence || "overview"

    affiliate_volume_cents = AffiliateCredit.sum(:amount_cents)

    metrics = {
      total_offers_count: OfferCode.alive.count,
      total_affiliates_count: Affiliate.alive.count,
      total_audience_count: AudienceMember.count,
      total_broadcasts_count: Installment.alive.count,
      total_affiliate_volume_cents: affiliate_volume_cents,
      formatted_affiliate_volume: formatted_etb_amount(affiliate_volume_cents)
    }

    offers = OfferCode.alive.order(id: :desc).limit(30).includes(:user).map do |offer|
      {
        id: offer.external_id,
        code: offer.code,
        seller_name: offer.user&.name.presence || offer.user&.email || "Unknown Seller",
        seller_id: offer.user&.external_id,
        discount_formatted: offer.amount_percentage.present? ? "#{offer.amount_percentage}%" : formatted_etb_amount(offer.amount_cents),
        uses_count: offer.times_used,
        max_uses: offer.max_purchase_count,
        expires_at: offer.expires_at&.as_json,
        created_at: offer.created_at.as_json
      }
    end

    affiliates = Affiliate.alive.order(id: :desc).limit(30).includes(:affiliate_user).map do |affiliate|
      fee_pct = if affiliate.respond_to?(:fee_percentage)
        affiliate.fee_percentage
      elsif affiliate.respond_to?(:affiliate_basis_points) && affiliate.affiliate_basis_points.present?
        (affiliate.affiliate_basis_points.to_f / 100).round(1)
      else
        0
      end

      {
        id: affiliate.external_id,
        email: affiliate.affiliate_user&.email || "Unknown",
        name: affiliate.affiliate_user&.name,
        fee_percentage: fee_pct,
        applies_to_all: affiliate.apply_to_all_products?,
        products_count: affiliate.products.count,
        created_at: affiliate.created_at.as_json
      }
    end

    audience_samples = AudienceMember.order(id: :desc).limit(30).includes(:seller).map do |member|
      {
        id: member.id,
        email: member.email,
        seller_name: member.seller&.name.presence || member.seller&.email || "Unknown Seller",
        is_follower: member.follower?,
        is_customer: member.customer?,
        is_affiliate: member.affiliate?,
        created_at: member.created_at.as_json
      }
    end

    workflows = Installment.alive.order(id: :desc).limit(30).includes(:seller).map do |inst|
      {
        id: inst.external_id,
        name: inst.name.presence || "Untitled Broadcast",
        seller_name: inst.seller&.name.presence || inst.seller&.email || "Unknown Seller",
        status: inst.alive? ? (inst.published? ? "published" : "draft") : "archived",
        published_at: inst.published_at&.as_json,
        created_at: inst.created_at.as_json
      }
    end

    render inertia: "Admin/Marketing/Index", props: {
      metrics:,
      offers:,
      affiliates:,
      audience_samples:,
      workflows:,
      active_tab:,
      current_admin: current_admin_props
    }
  end

  private
    def current_admin_props
      {
        name: current_user.name.presence || current_user.email,
        email: current_user.email,
        avatar_url: current_user.avatar_url
      }
    end
end
