# frozen_string_literal: true

class Admin::ReportsController < Admin::BaseController
  include CurrencyHelper

  layout "inertia"

  SUPPORTED_RANGES = [7, 30, 90].freeze
  DEFAULT_RANGE = 30

  def index
    render inertia: "Admin/Reports/Index", props: reports_props
  end

  private
    def reports_props
      {
        metrics: platform_health_metrics,
        trend: volume_trend_data,
        top_products: query_top_products,
        top_creators: query_top_creators,
        payment_methods: query_payment_distribution,
        selected_range:,
        current_admin: current_admin_props
      }
    end

    def selected_range
      range = params[:range].to_i
      SUPPORTED_RANGES.include?(range) ? range : DEFAULT_RANGE
    end

    def platform_health_metrics
      paid_purchases = Purchase.paid
      total_volume_cents = paid_purchases.sum(:price_cents)
      total_orders_count = paid_purchases.count
      aov_cents = total_orders_count.positive? ? (total_volume_cents.to_f / total_orders_count).round : 0

      refunded_count = Purchase.where(stripe_refunded: true).count
      total_attempted = total_orders_count + refunded_count
      refund_rate = total_attempted.positive? ? ((refunded_count.to_f / total_attempted) * 100).round(2) : 0.0

      dispute_count = Dispute.count
      dispute_rate = total_orders_count.positive? ? ((dispute_count.to_f / total_orders_count) * 100).round(2) : 0.0

      {
        gross_volume_cents: total_volume_cents,
        formatted_gross_volume: formatted_dollar_amount(total_volume_cents),
        total_orders: total_orders_count,
        average_order_value_cents: aov_cents,
        formatted_average_order_value: formatted_dollar_amount(aov_cents),
        refund_rate:,
        refunded_count:,
        dispute_rate:,
        dispute_count:
      }
    end

    def volume_trend_data
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
          formatted_revenue: formatted_dollar_amount(cents),
          orders_count: day_data[:count]
        }
      end

      {
        points:,
        range: selected_range
      }
    end

    def query_top_products
      top_data = Purchase.paid
        .where.not(link_id: nil)
        .group(:link_id)
        .order(Arel.sql("SUM(price_cents) DESC"))
        .limit(5)
        .pluck(:link_id, Arel.sql("SUM(price_cents)"), Arel.sql("COUNT(*)"))

      product_ids = top_data.map(&:first)
      products = Link.includes(:user).where(id: product_ids).index_by(&:id)

      top_data.filter_map do |link_id, cents, count|
        product = products[link_id]
        next unless product

        {
          id: product.external_id,
          permalink: product.unique_permalink,
          name: product.name,
          volume_cents: cents.to_i,
          formatted_volume: formatted_dollar_amount(cents.to_i),
          sales_count: count.to_i,
          creator_name: product.user&.name.presence || product.user&.username.presence || product.user&.email || "Unknown"
        }
      end
    end

    def query_top_creators
      top_data = Purchase.paid
        .where.not(seller_id: nil)
        .group(:seller_id)
        .order(Arel.sql("SUM(price_cents) DESC"))
        .limit(5)
        .pluck(:seller_id, Arel.sql("SUM(price_cents)"), Arel.sql("COUNT(*)"))

      seller_ids = top_data.map(&:first)
      sellers = User.where(id: seller_ids).index_by(&:id)

      top_data.filter_map do |seller_id, cents, count|
        seller = sellers[seller_id]
        next unless seller

        {
          id: seller.external_id,
          name: seller.name.presence || seller.username.presence || seller.email,
          username: seller.username,
          volume_cents: cents.to_i,
          formatted_volume: formatted_dollar_amount(cents.to_i),
          sales_count: count.to_i,
          admin_path: "/admin/creators/#{seller.username.presence || seller.external_id}"
        }
      end
    end

    def query_payment_distribution
      processor_data = Purchase.paid
        .group("COALESCE(purchases.charge_processor_id, 'card')")
        .order(Arel.sql("COUNT(*) DESC"))
        .limit(5)
        .pluck(
          Arel.sql("COALESCE(purchases.charge_processor_id, 'card')"),
          Arel.sql("COUNT(*)"),
          Arel.sql("SUM(price_cents)")
        )

      total_count = processor_data.sum { |_proc, count, _cents| count.to_i }

      processor_data.map do |processor, count, cents|
        count_int = count.to_i
        pct = total_count.positive? ? ((count_int.to_f / total_count) * 100).round(1) : 0.0

        {
          name: processor.to_s.titleize,
          orders_count: count_int,
          volume_cents: cents.to_i,
          formatted_volume: formatted_dollar_amount(cents.to_i),
          percentage: pct
        }
      end
    end

    def current_admin_props
      {
        name: current_user.name.presence || current_user.email,
        email: current_user.email,
        avatar_url: current_user.avatar_url
      }
    end
end
