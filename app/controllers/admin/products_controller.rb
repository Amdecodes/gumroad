# frozen_string_literal: true

class Admin::ProductsController < Admin::BaseController
  include Pagy::Backend
  include CurrencyHelper

  layout "inertia"

  before_action :set_product, only: %i[show unpublish publish]

  def index
    scope = build_products_scope

    @pagy, @products = pagy(
      scope,
      page: params[:page] || 1,
      limit: 20
    )

    product_ids = @products.map(&:id)
    sales_stats = compute_sales_stats(product_ids)

    render inertia: "Admin/Products/Index", props: {
      products: @products.map { |product| serialize_product_summary(product, sales_stats[product.id]) },
      pagy: {
        page: @pagy.page,
        pages: @pagy.pages,
        count: @pagy.count,
        next_page: @pagy.next,
        prev_page: @pagy.prev,
        has_more: @pagy.next.present?
      },
      filters: {
        q: params[:q].to_s,
        status: params[:status].to_s,
        creator_id: params[:creator_id].to_s
      },
      current_admin: current_admin_props
    }
  end

  def show
    sales_count = @product.sales.paid.count
    gross_cents = @product.sales.paid.sum(:price_cents)
    refund_count = @product.sales.where(stripe_refunded: true).count
    refund_rate = sales_count.positive? ? ((refund_count.to_f / sales_count) * 100).round(1) : 0.0
    customer_count = @product.sales.paid.distinct.count(:email)

    render inertia: "Admin/Products/Show", props: {
      product: serialize_product_detail(@product),
      creator: serialize_creator_detail(@product.user),
      metrics: {
        gross_sales_cents: gross_cents,
        gross_sales_formatted: formatted_etb_amount(gross_cents),
        units_sold: sales_count,
        refund_count:,
        refund_rate:,
        customer_count:
      },
      audit_history: audit_history_for(@product),
      current_admin: current_admin_props
    }
  end

  def unpublish
    reason = params[:reason].to_s.strip
    if reason.blank?
      error_message = "Reason is required for moderation action"
      return respond_with_moderation_error(error_message)
    end

    seller = @product.user
    result = Admin::InternalApiCaller.call(
      admin_user: current_user,
      method: :post,
      path: "/internal/admin/users/create_comment",
      params: {
        user_id: seller&.external_id,
        content: "Moderation [Unpublish Product #{@product.name} (#{@product.unique_permalink})]: #{reason}",
        idempotency_key: "unpublish-product-#{@product.external_id}-#{Time.current.to_i}"
      }
    )

    if result.success?
      @product.unpublish!(is_unpublished_by_admin: true)
      retarget_latest_audit_log!(target: @product, action: "products.unpublish")

      respond_with_moderation_success("Product unpublished and taken down successfully")
    else
      respond_with_moderation_error(result.error_message)
    end
  end

  def publish
    reason = params[:reason].to_s.strip
    if reason.blank?
      error_message = "Reason is required for moderation action"
      return respond_with_moderation_error(error_message)
    end

    seller = @product.user
    result = Admin::InternalApiCaller.call(
      admin_user: current_user,
      method: :post,
      path: "/internal/admin/users/create_comment",
      params: {
        user_id: seller&.external_id,
        content: "Moderation [Publish Product #{@product.name} (#{@product.unique_permalink})]: #{reason}",
        idempotency_key: "publish-product-#{@product.external_id}-#{Time.current.to_i}"
      }
    )

    if result.success?
      begin
        @product.publish_by_admin!
        retarget_latest_audit_log!(target: @product, action: "products.publish")

        respond_with_moderation_success("Product published successfully")
      rescue ActiveRecord::RecordInvalid => e
        respond_with_moderation_error(e.message)
      end
    else
      respond_with_moderation_error(result.error_message)
    end
  end

  private
    def set_product
      identifier = params[:id].to_s
      @product = Link
        .includes(:user, :product_files, :variant_categories)
        .find_by_external_id(identifier) ||
        Link
          .includes(:user, :product_files, :variant_categories)
          .find_by(unique_permalink: identifier)

      return if @product.present?

      if request.inertia? || request.format.html?
        redirect_to admin_products_path, alert: "Product not found"
      else
        render json: { success: false, message: "Product not found" }, status: :not_found
      end
    end

    def build_products_scope
      scope = Link.includes(:user, :product_files, :variant_categories).order(created_at: :desc, id: :desc)

      if params[:status].present? && params[:status] != "all"
        case params[:status]
        when "published"
          scope = scope.alive.where(draft: false)
        when "draft"
          scope = scope.where(draft: true, deleted_at: nil)
        when "unpublished"
          scope = scope.where.not(purchase_disabled_at: nil).where(deleted_at: nil)
        when "deleted"
          scope = scope.where.not(deleted_at: nil)
        end
      end

      if params[:creator_id].present?
        creator = User.find_by(external_id: params[:creator_id]) || User.find_by(username: params[:creator_id])
        scope = scope.where(user_id: creator.id) if creator.present?
      end

      if params[:q].present?
        q_term = "%#{ActiveRecord::Base.sanitize_sql_like(params[:q].strip)}%"
        scope = scope.left_outer_joins(:user).where(
          "links.name LIKE :q OR links.unique_permalink LIKE :q OR users.email LIKE :q OR users.name LIKE :q OR users.username LIKE :q",
          q: q_term
        )
      end

      scope
    end

    def compute_sales_stats(product_ids)
      return {} if product_ids.empty?

      Purchase.paid
        .where(link_id: product_ids)
        .group(:link_id)
        .pluck(:link_id, Arel.sql("COUNT(*)"), Arel.sql("SUM(price_cents)"))
        .to_h { |id, count, cents| [id, { count: count.to_i, cents: cents.to_i }] }
    end

    def serialize_product_summary(product, stats)
      sales_count = stats ? stats[:count] : 0
      revenue_cents = stats ? stats[:cents] : 0

      {
        id: product.external_id,
        permalink: product.unique_permalink,
        name: product.name,
        thumbnail_url: product.preview_url.presence,
        price_cents: product.price_cents,
        price_formatted: product.price_formatted,
        sales_count:,
        lifetime_revenue_formatted: formatted_etb_amount(revenue_cents),
        status: product_status(product),
        created_at: product.created_at.as_json,
        creator: product.user ? {
          id: product.user.external_id,
          name: product.user.name.presence || product.user.username.presence || product.user.email,
          username: product.user.username,
          email: product.user.email,
          admin_path: "/admin/creators/#{product.user.username.presence || product.user.external_id}"
        } : nil
      }
    end

    def serialize_product_detail(product)
      currency = (product.price_currency_type.presence || "etb").upcase

      {
        id: product.external_id,
        permalink: product.unique_permalink,
        name: product.name,
        description: product.description.to_s,
        status: product_status(product),
        is_published: product.published?,
        price_cents: product.price_cents,
        price_formatted: product.price_formatted,
        currency:,
        preview_url: product.preview_url.presence,
        store_url: product.long_url,
        created_at: product.created_at.as_json,
        is_licensed: product.is_licensed?,
        files_count: product.product_files.alive.count,
        variants_count: product.variant_categories.count,
        files: product.product_files.alive.map do |file|
          {
            id: file.external_id,
            display_name: file.name_displayable,
            extension: file.display_extension,
            size: file.size
          }
        end
      }
    end

    def serialize_creator_detail(user)
      return nil unless user

      {
        id: user.external_id,
        name: user.name.presence || user.username.presence || user.email,
        username: user.username,
        email: user.email,
        avatar_url: user.avatar_url,
        admin_path: "/admin/creators/#{user.username.presence || user.external_id}"
      }
    end

    def product_status(product)
      if product.deleted_at.present?
        "deleted"
      elsif product.banned_at.present?
        "banned"
      elsif product.purchase_disabled_at.present?
        "unpublished"
      elsif product.draft?
        "draft"
      else
        "published"
      end
    end

    def audit_history_for(product)
      logs = AdminApiAuditLog
        .where(
          "(target_type = 'Link' AND (target_id = :id OR target_external_id = :ext_id)) OR (action LIKE 'products.%' AND target_external_id = :ext_id)",
          id: product.id,
          ext_id: product.external_id
        )
        .order(created_at: :desc)
        .limit(10)

      logs.map do |log|
        actor = User.find_by(id: log.actor_user_id)
        {
          id: log.id,
          action: log.action,
          actor_name: actor&.name.presence || actor&.email || "System",
          response_status: log.response_status,
          created_at: log.created_at.as_json,
          note: log.params_snapshot&.dig("content") || log.params_snapshot&.dig("reason") || log.params_snapshot&.dig("note")
        }
      end
    end

    def retarget_latest_audit_log!(target:, action:)
      audit_log = AdminApiAuditLog.where(actor_user_id: current_user.id).order(id: :desc).first
      return unless audit_log

      audit_log.update_columns(
        target_type: "Link",
        target_id: target.id,
        target_external_id: target.external_id,
        action:
      )
    end

    def respond_with_moderation_success(message)
      if request.inertia? || request.format.html?
        redirect_to admin_product_path(@product.unique_permalink), notice: message
      else
        render json: { success: true, message: }
      end
    end

    def respond_with_moderation_error(error_message)
      if request.inertia? || request.format.html?
        redirect_to admin_product_path(@product.unique_permalink), alert: error_message
      else
        render json: { success: false, message: error_message }, status: :unprocessable_entity
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
