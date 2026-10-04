# frozen_string_literal: true

class Admin::OverviewController < Admin::BaseController
  include CurrencyHelper

  layout "inertia"

  SUPPORTED_RANGES = [7, 30, 90].freeze
  DEFAULT_RANGE = 30
  RECENT_ORDERS_LIMIT = 10

  def index
    render inertia: "Admin/Overview", props: overview_props
  end

  private
    def overview_props
      {
        metrics: kpi_metrics,
        needs_attention:,
        sales_trend: sales_trend_data,
        recent_orders:,
        current_admin: {
          name: current_user.name.presence || current_user.email,
          email: current_user.email,
          avatar_url: current_user.avatar_url
        }
      }
    end

    def kpi_metrics
      revenue_cents = Purchase.paid.sum(:price_cents)

      {
        revenue: {
          cents: revenue_cents,
          formatted: formatted_etb_amount(revenue_cents)
        },
        orders_count: Purchase.paid.count,
        creators_count: User.not_suspended.joins(:links).merge(Link.alive).distinct.count,
        customers_count: Purchase.paid.distinct.count(:email),
        subscriptions_count: Subscription.active.count
      }
    end

    def needs_attention
      {
        creators_requiring_review: User.where(user_risk_state: %w[flagged_for_fraud flagged_for_tos_violation]).count,
        payments_pending: Purchase.payment_settling.count,
        subscriptions_failing: Subscription.where.not(failed_at: nil).where(ended_at: nil, cancelled_at: nil).count,
        disputes_open: Dispute.where(state: %w[needs_response warning_needs_response]).count
      }
    end

    def sales_trend_data
      range = selected_range
      start_date = (range - 1).days.ago.to_date
      end_date = Date.current

      daily_aggregates = Purchase.paid
        .where("purchases.created_at >= ?", start_date.beginning_of_day)
        .group("DATE(purchases.created_at)")
        .pluck(
          Arel.sql("DATE(purchases.created_at)"),
          Arel.sql("SUM(purchases.price_cents)"),
          Arel.sql("COUNT(*)")
        )
        .to_h { |date_val, cents, count| [date_val.to_s, { cents: cents.to_i, count: count.to_i }] }

      points = (start_date..end_date).map do |date|
        date_str = date.to_s
        day_data = daily_aggregates[date_str] || { cents: 0, count: 0 }
        cents = day_data[:cents]
        {
          date: date_str,
          label: date.strftime("%b %-d"),
          revenue_cents: cents,
          revenue_formatted: formatted_etb_amount(cents),
          orders_count: day_data[:count]
        }
      end

      {
        points:,
        selected_range: range
      }
    end

    def recent_orders
      Purchase
        .for_admin_listing
        .limit(RECENT_ORDERS_LIMIT)
        .includes(:link, :seller)
        .map do |purchase|
          {
            id: purchase.external_id_numeric.to_s,
            customer_email: purchase.email,
            product_name: purchase.link&.name || purchase.link_name || "Custom charge",
            seller_name: purchase.seller&.name || purchase.seller&.email || "Unknown seller",
            amount_formatted: purchase.formatted_total_price,
            status: purchase.purchase_state,
            created_at: purchase.created_at.as_json
          }
        end
    end

    def selected_range
      parsed = params[:range].to_i
      SUPPORTED_RANGES.include?(parsed) ? parsed : DEFAULT_RANGE
    end
end
