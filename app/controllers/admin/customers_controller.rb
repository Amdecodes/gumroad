# frozen_string_literal: true

class Admin::CustomersController < Admin::BaseController
  include CurrencyHelper

  CUSTOMERS_PER_PAGE = 25

  before_action :fetch_customer, only: [:show]

  def index
    query_str = params[:q].to_s.strip

    purchases_scope = Purchase.all

    if query_str.present?
      sanitized = ActiveRecord::Base.sanitize_sql_like(query_str)
      purchases_scope = purchases_scope.where(
        "purchases.email LIKE :pattern OR purchases.full_name LIKE :pattern",
        pattern: "%#{sanitized}%"
      )
    end

    total_count = purchases_scope.select(:email).distinct.count
    page = [params[:page].to_i, 1].max
    limit = CUSTOMERS_PER_PAGE
    pages = [(total_count.to_f / limit).ceil, 1].max

    emails = purchases_scope
      .group(:email)
      .order(Arel.sql("MAX(purchases.id) DESC"))
      .offset((page - 1) * limit)
      .limit(limit)
      .pluck(:email)

    users_by_email = User.where(email: emails).index_by(&:email)

    aggregates = Purchase.where(email: emails).group(:email).pluck(
      :email,
      Arel.sql("COUNT(*)"),
      Arel.sql("COALESCE(SUM(CASE WHEN purchase_state = 'successful' THEN price_cents ELSE 0 END), 0)"),
      Arel.sql("MAX(purchases.created_at)")
    ).to_h { |em, cnt, vol, dt| [em, { count: cnt.to_i, volume_cents: vol.to_i, last_seen: dt }] }

    sub_counts = Subscription.joins(:purchases)
      .where(purchases: { email: emails })
      .where(cancelled_at: nil, deactivated_at: nil)
      .group("purchases.email")
      .count

    customers = emails.map do |email|
      user = users_by_email[email]
      stats = aggregates[email] || { count: 0, volume_cents: 0, last_seen: nil }
      sub_count = sub_counts[email] || 0

      # Determine display identifier: user external_id if registered, else URL-safe base64 email
      customer_id = user&.external_id || Base64.urlsafe_encode64(email)

      {
        id: customer_id,
        email:,
        name: user&.name.presence || Purchase.where(email:).where.not(full_name: [nil, ""]).order(id: :desc).pick(:full_name),
        orders_count: stats[:count],
        total_spent_cents: stats[:volume_cents],
        total_spent_formatted: formatted_etb_amount(stats[:volume_cents]),
        active_subscriptions_count: sub_count,
        is_registered: user.present?,
        user_id: user&.external_id,
        last_seen_at: stats[:last_seen]&.as_json
      }
    end

    render inertia: "Admin/Customers/Index", props: {
      customers:,
      pagination: {
        page:,
        pages:,
        count: total_count,
        has_more: page < pages
      },
      filters: {
        q: query_str
      },
      current_admin: current_admin_props
    }
  end

  def show
    user = User.find_by(email: @customer_email)
    purchases = Purchase.where(email: @customer_email)
      .includes(:link, :seller, :refunds, :license, :url_redirect)
      .order(created_at: :desc)

    subscriptions = Subscription.joins(:purchases)
      .where(purchases: { email: @customer_email })
      .includes(:link, :seller)
      .distinct
      .order(created_at: :desc)

    refunds = Refund.joins(:purchase)
      .where(purchases: { email: @customer_email })
      .includes(purchase: [:link, :seller])
      .order(created_at: :desc)

    total_spent_cents = purchases.select(&:successful?).sum(&:price_cents)
    customer_name = user&.name.presence || purchases.detect { _1.full_name.present? }&.full_name

    render inertia: "Admin/Customers/Show", props: {
      customer: {
        id: params[:id],
        email: @customer_email,
        name: customer_name,
        user_id: user&.external_id,
        is_registered: user.present?,
        registered_at: user&.created_at&.as_json,
        orders_count: purchases.size,
        total_spent_cents:,
        total_spent_formatted: formatted_etb_amount(total_spent_cents),
        active_subscriptions_count: subscriptions.count { _1.cancelled_at.blank? && _1.deactivated_at.blank? },
        refunds_count: refunds.size
      },
      purchases: purchases.map { |p| serialize_purchase(p) },
      subscriptions: subscriptions.map { |s| serialize_subscription(s) },
      refunds: refunds.map { |r| serialize_refund(r) },
      current_admin: current_admin_props
    }
  end

  private
    def fetch_customer
      identifier = params[:id].to_s.strip

      if identifier.include?("@")
        @customer_email = identifier
      elsif (user = User.find_by_external_id(identifier) || User.find_by(username: identifier))
        @customer_email = user.email
      elsif (purchase = Purchase.find_by_external_id(identifier))
        @customer_email = purchase.email
      else
        begin
          decoded = Base64.urlsafe_decode64(identifier)
          @customer_email = decoded if decoded.include?("@")
        rescue StandardError
          # Invalid base64
        end
      end

      return if @customer_email.present? && Purchase.where(email: @customer_email).exists?

      redirect_to admin_customers_path, alert: t("admin.customer_not_found", default: "Customer not found")
    end

    def current_admin_props
      {
        name: current_user.name.presence || current_user.email,
        email: current_user.email,
        avatar_url: current_user.avatar_url
      }
    end

    def serialize_purchase(order)
      {
        id: order.external_id,
        external_id_numeric: order.external_id_numeric.to_s,
        product_name: order.link&.name || order.link_name || "Custom Charge",
        seller_name: order.seller&.name || order.seller&.email || "Unknown Seller",
        amount_formatted: order.formatted_total_price,
        status: order.purchase_state,
        refund_status: order.refunded? ? "refunded" : (order.stripe_partially_refunded ? "partially_refunded" : nil),
        created_at: order.created_at.as_json,
        download_url: order.url_redirect.present? ? "/d/#{order.url_redirect.token}" : nil,
        receipt_url: receipt_purchase_url(order.external_id, host: UrlService.domain_with_protocol, email: order.email),
        license_serial: order.license&.serial,
        is_physical: order.link&.is_physical? || false
      }
    end

    def serialize_subscription(sub)
      status = if sub.deactivated_at.present?
        "deactivated"
      elsif sub.cancelled_at.present?
        "cancelled"
      elsif sub.failed_at.present?
        "failing"
      else
        "active"
      end

      {
        id: sub.external_id,
        product_name: sub.link&.name || "Membership",
        seller_name: sub.seller&.name || sub.seller&.email || "Unknown Seller",
        amount_formatted: formatted_etb_amount(sub.current_subscription_price_cents),
        frequency: sub.price&.recurrence || sub.try(:frequency) || "monthly",
        status:,
        created_at: sub.created_at.as_json,
        current_period_end: (sub.try(:next_charge_date) || sub.latest_grace_period_deadline)&.as_json
      }
    end

    def serialize_refund(refund)
      order = refund.purchase
      {
        id: refund.id,
        order_id: order&.external_id,
        product_name: order&.link&.name || "Custom Charge",
        seller_name: order&.seller&.name || order&.seller&.email || "Unknown Seller",
        amount_formatted: MoneyFormatter.format(refund.amount_cents, order&.displayed_price_currency_type || "etb"),
        reason: refund.reason,
        created_at: refund.created_at.as_json
      }
    end
end
