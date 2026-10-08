# frozen_string_literal: true

class Admin::SubscriptionsController < Admin::BaseController
  include Pagy::Backend
  include CurrencyHelper

  layout "inertia"

  SUBSCRIPTIONS_PER_PAGE = 25
  SUBSCRIPTION_INCLUDES = [:link, :seller, :user, :last_successful_purchase, :original_purchase].freeze

  before_action :fetch_subscription, only: [:show, :cancel]

  def index
    query_str = params[:q].to_s.strip
    status_filter = params[:status].to_s.strip.presence

    relation = Subscription.all.order(id: :desc)

    if status_filter.present?
      case status_filter
      when "active"
        relation = relation.where(cancelled_at: nil, deactivated_at: nil, failed_at: nil)
      when "failing"
        relation = relation.where.not(failed_at: nil).where(cancelled_at: nil, deactivated_at: nil)
      when "cancelled"
        relation = relation.where.not(cancelled_at: nil)
      when "deactivated"
        relation = relation.where.not(deactivated_at: nil)
      end
    end

    if query_str.present?
      id_val = Subscription.from_external_id(query_str) || (query_str.to_i if query_str.match?(/\A\d+\z/))
      sanitized = ActiveRecord::Base.sanitize_sql_like(query_str)
      pattern = "%#{sanitized}%"
      relation = relation.left_joins(:user, :seller, :link)

      relation = if id_val
        relation.where(
          "subscriptions.id = :id_val OR users.email LIKE :pattern OR users.name LIKE :pattern OR links.name LIKE :pattern",
          id_val:,
          pattern:
        )
      else
        relation.where(
          "users.email LIKE :pattern OR users.name LIKE :pattern OR links.name LIKE :pattern",
          pattern:
        )
      end
    end

    relation = relation.includes(SUBSCRIPTION_INCLUDES)

    @pagy, @subscriptions = pagy(
      relation,
      page: params[:page] || 1,
      limit: SUBSCRIPTIONS_PER_PAGE,
      overflow: :empty_page
    )

    render inertia: "Admin/Subscriptions/Index", props: {
      subscriptions: @subscriptions.map { |sub| serialize_subscription_summary(sub) },
      pagination: {
        page: @pagy.page,
        pages: @pagy.pages,
        count: @pagy.count,
        has_more: @pagy.next.present?
      },
      filters: {
        q: query_str,
        status: status_filter
      },
      current_admin: current_admin_props
    }
  end

  def show
    render inertia: "Admin/Subscriptions/Show", props: {
      subscription: serialize_subscription_detail(@subscription),
      current_admin: current_admin_props
    }
  end

  def cancel
    if @subscription.cancelled_at.present? || @subscription.deactivated_at.present?
      return redirect_to admin_subscription_path(@subscription.external_id), alert: "Subscription is already cancelled or deactivated"
    end

    @subscription.cancel!(by_seller: false)

    redirect_to admin_subscription_path(@subscription.external_id), notice: "Successfully cancelled subscription"
  rescue StandardError => e
    redirect_to admin_subscription_path(@subscription.external_id), alert: "Failed to cancel subscription: #{e.message}"
  end

  private
    def fetch_subscription
      @subscription = Subscription.find_by_external_id(params[:id])
      return if @subscription.present?

      redirect_to admin_subscriptions_path, alert: "Subscription not found"
    end

    def current_admin_props
      {
        name: current_user.name.presence || current_user.email,
        email: current_user.email,
        avatar_url: current_user.avatar_url
      }
    end

    def subscription_status(sub)
      if sub.deactivated_at.present?
        "deactivated"
      elsif sub.cancelled_at.present?
        "cancelled"
      elsif sub.failed_at.present?
        "failing"
      else
        "active"
      end
    end

    def subscription_price_cents(sub)
      sub.current_subscription_price_cents
    rescue StandardError
      sub.price&.price_cents || sub.link&.price_cents || 0
    end

    def serialize_subscription_summary(sub)
      subscriber_email = sub.user&.email || sub.original_purchase&.email || "Guest Subscriber"
      subscriber_name = sub.user&.name.presence || sub.original_purchase&.purchaser&.name
      price_cents = subscription_price_cents(sub)

      {
        id: sub.external_id,
        subscriber_email:,
        subscriber_name:,
        product_name: sub.link&.name || "Membership",
        product_id: sub.link&.external_id,
        seller_name: sub.seller&.name || sub.seller&.email || "Unknown Seller",
        seller_id: sub.seller&.external_id,
        amount_formatted: formatted_etb_amount(price_cents),
        frequency: sub.price&.recurrence || sub.try(:frequency) || "monthly",
        status: subscription_status(sub),
        created_at: sub.created_at.as_json,
        current_period_end: (sub.try(:next_charge_date) || (sub.failed_at.present? ? sub.failed_at + Subscription::GRACE_PERIOD : nil))&.as_json
      }
    end

    def serialize_subscription_detail(sub)
      subscriber_email = sub.user&.email || sub.original_purchase&.email || "Guest Subscriber"
      subscriber_name = sub.user&.name.presence || sub.original_purchase&.purchaser&.name
      price_cents = subscription_price_cents(sub)

      charges = sub.purchases.order(created_at: :desc).limit(20).map do |purchase|
        {
          id: purchase.external_id,
          amount_formatted: purchase.formatted_total_price,
          status: purchase.purchase_state,
          payment_processor: purchase.charge_processor_id.presence || "chapa",
          transaction_id: purchase.processor_transaction_id.presence || purchase.stripe_transaction_id,
          created_at: purchase.created_at.as_json
        }
      end

      {
        id: sub.external_id,
        subscriber: {
          id: sub.user&.external_id,
          name: subscriber_name,
          email: subscriber_email
        },
        seller: {
          id: sub.seller&.external_id,
          name: sub.seller&.name || sub.seller&.email || "Unknown Seller",
          email: sub.seller&.email
        },
        product: {
          id: sub.link&.external_id,
          name: sub.link&.name || "Membership",
          unique_permalink: sub.link&.unique_permalink
        },
        amount_formatted: formatted_etb_amount(price_cents),
        price_cents: price_cents,
        frequency: sub.price&.recurrence || sub.try(:frequency) || "monthly",
        status: subscription_status(sub),
        is_installment_plan: sub.is_installment_plan?,
        charges_completed: sub.charge_occurrence_count,
        created_at: sub.created_at.as_json,
        updated_at: sub.updated_at.as_json,
        cancelled_at: sub.cancelled_at&.as_json,
        failed_at: sub.failed_at&.as_json,
        deactivated_at: sub.deactivated_at&.as_json,
        next_charge_date: sub.try(:next_charge_date)&.as_json,
        grace_period_deadline: (sub.failed_at.present? ? sub.failed_at + Subscription::GRACE_PERIOD : nil)&.as_json,
        charges:
      }
    end
end
