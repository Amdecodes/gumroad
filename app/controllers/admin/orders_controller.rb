# frozen_string_literal: true

class Admin::OrdersController < Admin::BaseController
  include Pagy::Backend
  include CurrencyHelper

  ORDERS_PER_PAGE = 25
  ORDER_DETAIL_INCLUDES = [
    :link,
    :seller,
    :refunds,
    :purchaser,
    :subscription,
    :license,
    :gift_given,
    :gift_received,
    :url_redirect,
    { affiliate_credit: :affiliate_user }
  ].freeze

  before_action :fetch_order, only: [:show, :resend_receipt, :refund, :cancel_subscription]

  def index
    query_str = params[:q].to_s.strip
    status_filter = params[:status].to_s.strip.presence
    date_filter = params[:date].to_s.strip.presence

    relation = if query_str.present?
      if query_str.include?("@")
        AdminSearchService.new.search_purchases(email: query_str)
      else
        AdminSearchService.new.search_purchases(query: query_str)
      end
    else
      Purchase.for_admin_listing
    end

    if status_filter.present?
      case status_filter
      when "successful"
        relation = relation.where(purchase_state: "successful")
      when "failed"
        relation = relation.where(purchase_state: "failed")
      when "not_charged"
        relation = relation.where(purchase_state: "not_charged")
      when "refunded"
        relation = relation.where(stripe_refunded: true)
      when "chargeback"
        relation = relation.where.not(chargeback_date: nil).where("purchases.flags & ? = 0", Purchase.flag_mapping["flags"][:chargeback_reversed])
      end
    end

    if date_filter.present?
      begin
        parsed_date = Date.parse(date_filter)
        relation = relation.where("purchases.created_at >= ? AND purchases.created_at <= ?", parsed_date.beginning_of_day, parsed_date.end_of_day)
      rescue ArgumentError, Date::Error
        # ignore invalid date filter string
      end
    end

    relation = relation.includes(:link, :seller, :refunds)

    pagination, paginated_orders = pagy(
      relation,
      page: params[:page],
      limit: ORDERS_PER_PAGE,
      overflow: :empty_page
    )

    render inertia: "Admin/Orders/Index", props: {
      orders: paginated_orders.map { |order| serialize_order_summary(order) },
      pagination: {
        page: pagination.page,
        pages: pagination.pages,
        count: pagination.count,
        has_more: pagination.next.present?
      },
      filters: {
        q: query_str,
        status: status_filter,
        date: date_filter
      },
      current_admin: current_admin_props
    }
  rescue AdminSearchService::InvalidDateError, AdminSearchService::InsufficientSearchCriteriaError
    render inertia: "Admin/Orders/Index", props: {
      orders: [],
      pagination: { page: 1, pages: 1, count: 0, has_more: false },
      filters: { q: query_str, status: status_filter, date: date_filter },
      current_admin: current_admin_props
    }
  end

  def show
    ActiveRecord::Associations::Preloader.new(records: [@order], associations: ORDER_DETAIL_INCLUDES).call

    render inertia: "Admin/Orders/Show", props: {
      order: serialize_order_detail(@order),
      current_admin: current_admin_props
    }
  end

  def resend_receipt
    result = Admin::InternalApiCaller.call(
      admin_user: current_user,
      method: :post,
      path: "/internal/admin/purchases/#{@order.external_id_numeric}/resend_receipt"
    )

    if result.success?
      message = result.data&.fetch("message", "Successfully resent receipt")
      if request.inertia? || request.format.html?
        redirect_to admin_order_path(@order.external_id), notice: message
      else
        render json: result.data, status: result.status
      end
    else
      error_message = result.error_message
      if request.inertia? || request.format.html?
        redirect_to admin_order_path(@order.external_id), alert: error_message
      else
        render json: result.data, status: result.status
      end
    end
  end

  def refund
    reason = params[:reason].to_s.strip
    if reason.blank?
      error_message = "reason is required"
      if request.inertia? || request.format.html?
        redirect_to admin_order_path(@order.external_id), alert: error_message
      else
        render json: { success: false, message: error_message }, status: :bad_request
      end
      return
    end

    if @order.charge_processor_id == "chapa" || @order.order&.charges&.where(processor: "chapa")&.exists?
      service = Chapa::RefundService.new(
        purchase: @order,
        amount_cents: params[:amount_cents],
        reason:,
        admin_user: current_user
      )
      result = service.perform
      if result[:success]
        message = result[:message] || "Successfully refunded order"
        if request.inertia? || request.format.html?
          redirect_to admin_order_path(@order.external_id), notice: message
        else
          render json: { success: true, message: }, status: :ok
        end
      else
        error_message = result[:error] || "Refund failed"
        if request.inertia? || request.format.html?
          redirect_to admin_order_path(@order.external_id), alert: error_message
        else
          render json: { success: false, message: error_message }, status: :unprocessable_entity
        end
      end
      return
    end

    result = Admin::InternalApiCaller.call(
      admin_user: current_user,
      method: :post,
      path: "/internal/admin/purchases/#{@order.external_id_numeric}/refund",
      params: {
        email: @order.email,
        reason:
      }
    )

    if result.success?
      message = result.data&.fetch("message", "Successfully refunded order")
      if request.inertia? || request.format.html?
        redirect_to admin_order_path(@order.external_id), notice: message
      else
        render json: result.data, status: result.status
      end
    else
      error_message = result.error_message
      if request.inertia? || request.format.html?
        redirect_to admin_order_path(@order.external_id), alert: error_message
      else
        render json: result.data, status: result.status
      end
    end
  end

  def reverify
    tx_ref = params[:tx_ref].presence || @order.processor_transaction_id.presence
    if tx_ref.blank?
      chapa_tx = @order.order&.chapa_transactions&.order(created_at: :desc)&.first ||
                 ChapaTransaction.where(purchase_id: @order.id).order(created_at: :desc).first
      tx_ref = chapa_tx&.tx_ref
    end

    if tx_ref.blank?
      return redirect_to admin_order_path(@order.external_id), alert: "No Chapa transaction found to re-verify"
    end

    result = Chapa::FinalizerService.new(tx_ref:).reverify!
    if result[:success]
      status_text = result[:already_finalized] ? "already finalized" : "successfully verified"
      redirect_to admin_order_path(@order.external_id), notice: "Transaction #{status_text}: #{result[:status]}"
    else
      redirect_to admin_order_path(@order.external_id), alert: "Re-verification failed: #{result[:error]}"
    end
  end

  def cancel_subscription
    result = Admin::InternalApiCaller.call(
      admin_user: current_user,
      method: :post,
      path: "/internal/admin/purchases/#{@order.external_id_numeric}/cancel_subscription",
      params: {
        email: @order.email
      }
    )

    if result.success?
      message = result.data&.fetch("message", "Successfully cancelled subscription")
      if request.inertia? || request.format.html?
        redirect_to admin_order_path(@order.external_id), notice: message
      else
        render json: result.data, status: result.status
      end
    else
      error_message = result.error_message
      if request.inertia? || request.format.html?
        redirect_to admin_order_path(@order.external_id), alert: error_message
      else
        render json: result.data, status: result.status
      end
    end
  end

  private
    def fetch_order
      @order = Purchase.find_by_external_id(params[:id])
      return if @order.present?

      if request.inertia? || request.format.html?
        redirect_to admin_orders_path, alert: t("admin.order_not_found", default: "Order not found")
      else
        render json: { success: false, message: t("admin.order_not_found", default: "Order not found") }, status: :not_found
      end
    end

    def current_admin_props
      {
        name: current_user.name.presence || current_user.email,
        email: current_user.email,
        avatar_url: current_user.avatar_url
      }
    end

    def serialize_order_summary(order)
      {
        id: order.external_id,
        external_id_numeric: order.external_id_numeric.to_s,
        customer_email: order.email,
        product_name: order.link&.name || order.link_name || "Custom Charge",
        seller_name: order.seller&.name || order.seller&.email || "Unknown Seller",
        amount_formatted: order.formatted_total_price,
        status: order.purchase_state,
        refund_status: order.refunded? ? "refunded" : (order.stripe_partially_refunded ? "partially_refunded" : nil),
        created_at: order.created_at.as_json
      }
    end

    def serialize_order_detail(order)
      subscription = order.subscription
      license = if order.is_recurring_subscription_charge
        order.subscription&.original_purchase&.license
      else
        order.license
      end
      gift = order.gift
      affiliate_credit = order.affiliate_credit

      {
        id: order.external_id,
        external_id_numeric: order.external_id_numeric.to_s,
        customer_email: order.email,
        customer_name: order.purchaser&.name,
        product_name: order.link&.name || order.link_name || "Custom Charge",
        product_id: order.link&.external_id,
        variant_name: order.variants_list.presence || order.variant_names&.join(", "),
        seller: {
          id: order.seller&.external_id,
          name: order.seller&.name || order.seller&.email || "Unknown Seller",
          email: order.seller&.email
        },
        amount_formatted: order.formatted_total_price,
        price_cents: order.price_cents,
        currency: order.displayed_price_currency_type.to_s.upcase,
        platform_fee_formatted: MoneyFormatter.format(order.fee_cents, order.displayed_price_currency_type),
        refunded_amount_formatted: (order.refunded? || order.amount_refunded_cents.to_i > 0) ? MoneyFormatter.format(order.amount_refunded_cents.to_i, order.displayed_price_currency_type) : nil,
        status: order.purchase_state,
        refund_status: order.refunded? ? "refunded" : (order.stripe_partially_refunded ? "partially_refunded" : nil),
        is_chargeback: order.chargeback_date.present?,
        chargeback_date: order.chargeback_date&.as_json,
        created_at: order.created_at.as_json,
        payment_processor: order.charge_processor_id,
        transaction_id: order.stripe_transaction_id.presence || order.paypal_order_id.presence || order.processor_transaction_id,
        chapa_details: begin
          chapa_tx = order.order&.chapa_transactions&.order(created_at: :desc)&.first ||
                     ChapaTransaction.where(purchase_id: order.id).order(created_at: :desc).first ||
                     (order.processor_transaction_id.present? ? ChapaTransaction.find_by(tx_ref: order.processor_transaction_id) : nil)
          chapa_tx ? {
            tx_ref: chapa_tx.tx_ref,
            chapa_reference: chapa_tx.chapa_reference,
            status: chapa_tx.status,
            mode: chapa_tx.mode,
            charge_formatted: chapa_tx.charge_decimal.present? ? "#{chapa_tx.charge_decimal} ETB" : nil,
            payment_method: chapa_tx.payment_method,
            verified_at: chapa_tx.verified_at&.as_json
          } : nil
        end,
        refunds: order.refunds.map do |refund|
          {
            id: refund.id,
            amount_formatted: MoneyFormatter.format(refund.amount_cents, order.displayed_price_currency_type),
            reason: refund.reason,
            created_at: refund.created_at.as_json
          }
        end,
        subscription: subscription ? {
          id: subscription.external_id,
          is_active: subscription.cancelled_at.blank? && subscription.failed_at.blank? && !subscription.deactivated?,
          status: subscription.cancelled_at.present? ? "cancelled" : (subscription.failed_at.present? ? "failing" : "active"),
          cancelled_at: subscription.cancelled_at&.as_json,
          failed_at: subscription.failed_at&.as_json,
          frequency: subscription.price&.recurrence || subscription.try(:frequency)
        } : nil,
        license: license ? {
          id: license.external_id,
          serial: license.serial,
          disabled: license.disabled?
        } : nil,
        gift: gift ? {
          gifter_email: gift.gifter_email,
          giftee_email: gift.giftee_email
        } : nil,
        affiliate: affiliate_credit ? {
          affiliate_user_email: affiliate_credit.affiliate_user&.email,
          affiliate_user_name: affiliate_credit.affiliate_user&.name,
          amount_formatted: MoneyFormatter.format(affiliate_credit.amount_cents, order.displayed_price_currency_type)
        } : nil,
        access: {
          has_download: order.url_redirect.present?,
          download_url: order.url_redirect.present? ? "/d/#{order.url_redirect.token}" : nil,
          receipt_url: receipt_purchase_url(order.external_id, host: UrlService.domain_with_protocol, email: order.email)
        }
      }
    end
end
