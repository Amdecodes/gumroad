# frozen_string_literal: true

class Admin::PayoutsController < Admin::BaseController
  include CurrencyHelper
  include Pagy::Backend

  before_action :find_payout, only: [:show, :mark_paid, :cancel]

  def index
    status_filter = params[:status].to_s.strip.presence
    search_query = params[:q].to_s.strip.presence

    payment_scope = build_payment_scope(status: status_filter, query: search_query)
    scheduled_scope = build_scheduled_scope(status: status_filter, query: search_query)

    # Paginate using either single scope or combined array
    if payment_scope.none? && scheduled_scope.any?
      @pagy, records = pagy(scheduled_scope)
    elsif payment_scope.any? && scheduled_scope.none?
      @pagy, records = pagy(payment_scope)
    else
      combined = (scheduled_scope.to_a + payment_scope.to_a).sort_by { |p| -(p.created_at.to_f) }
      @pagy, records = pagy_array(combined)
    end

    payouts = records.map { |r| serialize_payout_for_listing(r) }

    metrics = calculate_metrics

    render inertia: "Admin/Payouts/Index", props: {
      payouts:,
      pagy: PagyPresenter.new(@pagy).props,
      metrics:,
      filters: {
        status: status_filter || "all",
        q: search_query || ""
      },
      current_admin: {
        name: current_user.name,
        email: current_user.email
      }
    }
  end

  def show
    render inertia: "Admin/Payouts/Show", props: serialize_payout_detail(@payout)
  end

  def mark_paid
    unless @payout.is_a?(ScheduledPayout)
      return render json: {
        success: false,
        message: "Manual approval is only available for pending scheduled payouts."
      }, status: :unprocessable_entity
    end

    result = Admin::InternalApiCaller.call(
      admin_user: current_user,
      method: :post,
      path: "/internal/admin/scheduled_payouts/#{@payout.external_id}/execute"
    )

    if result.success?
      if params[:note].present?
        @payout.user.comments.create!(
          author_id: current_user.id,
          comment_type: Comment::COMMENT_TYPE_PAYOUT_NOTE,
          content: "Payout executed: #{params[:note]}"
        )
      end

      respond_to do |format|
        format.html { redirect_to admin_payout_path(@payout.external_id), notice: "Payout marked as paid." }
        format.json { render json: { success: true, message: result.data["message"] || "Payout executed successfully." } }
      end
    else
      error_message = result.error_message
      render json: { success: false, message: error_message }, status: result.status == 200 ? :unprocessable_entity : result.status
    end
  end

  def cancel
    if params[:reason].blank?
      return render json: { success: false, message: "Reason is required to cancel a payout." }, status: :unprocessable_entity
    end

    unless @payout.is_a?(ScheduledPayout)
      return render json: {
        success: false,
        message: "Cannot cancel an executed payment transfer."
      }, status: :unprocessable_entity
    end

    result = Admin::InternalApiCaller.call(
      admin_user: current_user,
      method: :post,
      path: "/internal/admin/scheduled_payouts/#{@payout.external_id}/cancel"
    )

    if result.success?
      @payout.user.comments.create!(
        author_id: current_user.id,
        comment_type: Comment::COMMENT_TYPE_PAYOUT_NOTE,
        content: "Scheduled payout cancelled: #{params[:reason]}"
      )

      respond_to do |format|
        format.html { redirect_to admin_payout_path(@payout.external_id), notice: "Payout cancelled." }
        format.json { render json: { success: true, message: "Payout cancelled successfully." } }
      end
    else
      error_message = result.error_message
      render json: { success: false, message: error_message }, status: result.status == 200 ? :unprocessable_entity : result.status
    end
  end

  private
    def find_payout
      @payout = ScheduledPayout.includes(:user).find_by_external_id(params[:id])
      @payout ||= Payment.includes(:user, :bank_account).find_by_external_id(params[:id])

      if @payout.blank?
        render file: Rails.public_path.join("404.html"), status: :not_found, layout: false
      end
    end

    def build_payment_scope(status:, query:)
      scope = Payment.includes(:user, :bank_account).order(created_at: :desc, id: :desc)

      if status.present? && status != "all"
        case status
        when "pending"
          scope = scope.where(state: %w[creating processing unclaimed])
        when "completed"
          scope = scope.where(state: "completed")
        when "failed"
          scope = scope.where(state: "failed")
        when "cancelled"
          scope = scope.where(state: "cancelled")
        else
          scope = scope.where(state: status)
        end
      end

      if query.present?
        cleaned_query = query.delete_prefix("@")
        decrypted_id = Payment.from_external_id(cleaned_query) rescue nil

        scope = scope.joins("LEFT JOIN users ON users.id = payments.user_id").where(
          "payments.txn_id LIKE :like_q OR payments.stripe_transfer_id LIKE :like_q OR payments.id = :id OR users.email LIKE :like_q OR users.username LIKE :like_q OR users.name LIKE :like_q",
          like_q: "%#{ActiveRecord::Base.sanitize_sql_like(cleaned_query)}%",
          id: decrypted_id || -1
        )
      end

      scope
    end

    def build_scheduled_scope(status:, query:)
      scope = ScheduledPayout.includes(:user).order(created_at: :desc, id: :desc)

      if status.present? && status != "all"
        case status
        when "pending"
          scope = scope.where(status: %w[pending flagged held])
        when "completed"
          scope = scope.where(status: "executed")
        when "failed"
          return ScheduledPayout.none
        when "cancelled"
          scope = scope.where(status: "cancelled")
        else
          scope = scope.where(status: status)
        end
      end

      if query.present?
        cleaned_query = query.delete_prefix("@")
        decrypted_id = ScheduledPayout.from_external_id(cleaned_query) rescue nil

        scope = scope.joins(:user).where(
          "scheduled_payouts.id = :id OR users.email LIKE :like_q OR users.username LIKE :like_q OR users.name LIKE :like_q",
          like_q: "%#{ActiveRecord::Base.sanitize_sql_like(cleaned_query)}%",
          id: decrypted_id || -1
        )
      end

      scope
    end

    def calculate_metrics
      pending_payment_cents = Payment.where(state: %w[creating processing unclaimed]).sum(:amount_cents)
      pending_scheduled_cents = ScheduledPayout.where(status: %w[pending flagged held]).sum(:payout_amount_cents)
      pending_count = Payment.where(state: %w[creating processing unclaimed]).count + ScheduledPayout.where(status: %w[pending flagged held]).count
      pending_total_cents = pending_payment_cents + pending_scheduled_cents

      completed_payments = Payment.where(state: "completed").where("created_at >= ?", 30.days.ago)
      completed_count = completed_payments.count
      completed_total_cents = completed_payments.sum(:amount_cents)

      {
        pending_count:,
        pending_amount_cents: pending_total_cents,
        formatted_pending_amount: Money.new(pending_total_cents, "USD").format,
        completed_count_30d: completed_count,
        completed_amount_cents_30d: completed_total_cents,
        formatted_completed_amount_30d: Money.new(completed_total_cents, "USD").format
      }
    end

    def serialize_payout_for_listing(payout)
      if payout.is_a?(ScheduledPayout)
        user = payout.user
        bank_account = user&.active_bank_account
        reference = payout.external_id
        amount_cents = payout.payout_amount_cents
        status = map_scheduled_status(payout.status)
        processor = payout.processor
        created_at = payout.created_at
        destination_method = destination_label(bank_account, user&.payment_address, processor)
      else
        user = payout.user
        bank_account = payout.bank_account
        reference = payout.txn_id.presence || payout.stripe_transfer_id.presence || payout.external_id
        amount_cents = payout.amount_cents
        status = map_payment_status(payout.state)
        processor = payout.processor
        created_at = payout.created_at
        destination_method = destination_label(bank_account, payout.payment_address, processor)
      end

      currency = (payout.respond_to?(:currency) && payout.currency.presence) || "usd"

      {
        id: payout.external_id,
        external_id: payout.external_id,
        reference:,
        amount_cents:,
        formatted_amount: Money.new(amount_cents || 0, currency).format,
        currency:,
        status:,
        destination_method:,
        created_at: created_at.as_json,
        creator: user ? {
          external_id: user.external_id,
          name: user.name,
          username: user.username,
          email: user.form_email,
          avatar_url: user.avatar_url,
          admin_path: "/admin/creators/#{user.username.presence || user.external_id}"
        } : nil
      }
    end

    def serialize_payout_detail(payout)
      if payout.is_a?(ScheduledPayout)
        user = payout.user
        bank_account = user&.active_bank_account
        reference = payout.external_id
        amount_cents = payout.payout_amount_cents
        currency = "usd"
        status = map_scheduled_status(payout.status)
        processor = payout.processor
        date_requested = payout.created_at
        date_processed = payout.executed_at
        can_mark_paid = %w[pending flagged held].include?(payout.status)
        can_cancel = %w[pending flagged held].include?(payout.status)

        sales_volume_cents = amount_cents
        platform_fee_cents = 0
        processor_fee_cents = 0
        adjustments_cents = 0
      else
        user = payout.user
        bank_account = payout.bank_account
        reference = payout.txn_id.presence || payout.stripe_transfer_id.presence || payout.external_id
        amount_cents = payout.amount_cents
        currency = payout.currency.presence || "usd"
        status = map_payment_status(payout.state)
        processor = payout.processor
        date_requested = payout.created_at
        date_processed = (payout.state == Payment::COMPLETED) ? payout.updated_at : nil
        can_mark_paid = false
        can_cancel = false

        processor_fee_cents = payout.processor_fee_cents.to_i
        gumroad_fee_cents = payout.gumroad_fee_cents.to_i
        adjustments_cents = payout.respond_to?(:credit_amount_cents) ? payout.credit_amount_cents.to_i : 0
        sales_volume_cents = amount_cents + processor_fee_cents + gumroad_fee_cents - adjustments_cents
        platform_fee_cents = gumroad_fee_cents
      end

      audit_logs = AdminApiAuditLog.where(
        target_type: payout.class.name,
        target_id: payout.id
      ).order(created_at: :desc).limit(20)

      {
        payout: {
          external_id: payout.external_id,
          reference:,
          amount_cents:,
          formatted_amount: Money.new(amount_cents || 0, currency).format,
          currency:,
          status:,
          date_requested: date_requested.as_json,
          date_processed: date_processed&.as_json,
          processor: processor&.titleize || "Direct",
          can_mark_paid:,
          can_cancel:
        },
        creator: user ? {
          external_id: user.external_id,
          name: user.name,
          username: user.username,
          email: user.form_email,
          avatar_url: user.avatar_url,
          admin_path: "/admin/creators/#{user.username.presence || user.external_id}"
        } : nil,
        destination: {
          method_type: destination_type_label(bank_account, user&.payment_address, processor),
          processor: processor&.titleize || "Direct",
          bank_name: bank_account&.bank_name,
          account_number_visual: bank_account&.account_number_visual,
          routing_number: bank_account&.routing_number,
          account_holder_name: bank_account&.account_holder_full_name,
          account_type: bank_account&.account_type,
          paypal_email: payout.is_a?(Payment) ? payout.payment_address : user&.payment_address
        },
        breakdown: {
          sales_volume_cents:,
          formatted_sales_volume: Money.new(sales_volume_cents || 0, currency).format,
          platform_fee_cents:,
          formatted_platform_fee: Money.new(platform_fee_cents || 0, currency).format,
          processor_fee_cents:,
          formatted_processor_fee: Money.new(processor_fee_cents || 0, currency).format,
          adjustments_cents:,
          formatted_adjustments: Money.new(adjustments_cents || 0, currency).format,
          net_amount_cents: amount_cents,
          formatted_net_amount: Money.new(amount_cents || 0, currency).format
        },
        audit_history: audit_logs.map do |log|
          {
            id: log.id,
            action: log.action,
            actor_name: log.actor_user&.name || "System",
            actor_email: log.actor_user&.email,
            created_at: log.created_at.as_json,
            response_status: log.response_status,
            note: log.params_snapshot&.dig("note") || log.params_snapshot&.dig("reason") || log.params_snapshot&.dig("suspension_note")
          }
        end,
        current_admin: {
          name: current_user.name,
          email: current_user.email
        }
      }
    end

    def map_scheduled_status(status)
      case status
      when "pending", "flagged", "held"
        "pending"
      when "executed"
        "completed"
      when "cancelled"
        "cancelled"
      else
        status
      end
    end

    def map_payment_status(state)
      case state
      when "creating", "processing", "unclaimed"
        "pending"
      when "completed"
        "completed"
      when "failed"
        "failed"
      when "cancelled"
        "cancelled"
      when "reversed", "returned"
        "returned"
      else
        state
      end
    end

    def destination_label(bank_account, payment_address, processor)
      if bank_account&.account_number_visual.present?
        "Bank #{bank_account.account_number_visual}"
      elsif payment_address.present?
        "PayPal (#{payment_address})"
      elsif processor.present?
        processor.titleize
      else
        "Direct Transfer"
      end
    end

    def destination_type_label(bank_account, payment_address, processor)
      if bank_account.present?
        "bank"
      elsif payment_address.present? || processor.to_s.casecmp("paypal").zero?
        "paypal"
      elsif processor.to_s.casecmp("stripe").zero?
        "stripe"
      else
        "direct"
      end
    end
end
