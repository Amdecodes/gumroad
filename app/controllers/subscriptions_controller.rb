# frozen_string_literal: true

class SubscriptionsController < ApplicationController
  include PageMeta::Product

  PUBLIC_ACTIONS = %i[manage unsubscribe_by_user renew].freeze
  before_action :authenticate_user!, except: PUBLIC_ACTIONS
  after_action :verify_authorized, except: PUBLIC_ACTIONS

  before_action :fetch_subscription, only: %i[unsubscribe_by_seller unsubscribe_by_user]
  before_action :set_noindex_header, only: [:manage]
  before_action :check_can_manage, only: [:manage, :unsubscribe_by_user, :renew]

  layout "inertia", only: [:manage]

  SUBSCRIPTION_COOKIE_EXPIRY = 1.week

  def unsubscribe_by_seller
    authorize @subscription

    @subscription.cancel!(by_seller: true)
    head :no_content
  end

  def unsubscribe_by_user
    @subscription.cancel!(by_seller: false)
    subscription_entity = @subscription.is_installment_plan ? t("installment_plan") : t("membership")
    redirect_to manage_subscription_path(@subscription.external_id), notice: t("flash.subscriptions.cancelled", entity: subscription_entity)
  rescue ActiveRecord::RecordInvalid => e
    redirect_to manage_subscription_path(@subscription.external_id), alert: e.message
  end

  def renew
    unless @subscription.alive_or_restartable?
      return render json: { error: "Subscription cannot be renewed" }, status: :unprocessable_entity
    end

    if @subscription.seller.suspended?
      return render json: { error: "Seller account is suspended" }, status: :unprocessable_entity
    end

    price_santims = @subscription.current_subscription_price_cents
    if price_santims <= 0
      return render json: { error: "Invalid renewal price" }, status: :unprocessable_entity
    end

    tx_ref = "arifdrop-sub-renew-#{@subscription.id}-#{SecureRandom.hex(4)}"

    purchase = @subscription.build_purchase(
      override_params: {
        processor: "chapa",
        charge_processor_id: "chapa",
        processor_transaction_id: tx_ref,
        displayed_price_currency_type: "etb",
        price_cents: price_santims,
        displayed_price_cents: price_santims,
        total_transaction_cents: price_santims,
        is_original_subscription_purchase: false
      }
    )
    purchase.calculate_fees
    purchase.fee_cents ||= 0
    purchase.save!(validate: false)

    callback_url = chapa_webhook_url
    return_url = chapa_callback_purchase_url(purchase.id)

    client = Chapa::Client.new
    init_result = client.initialize_transaction(
      purchase:,
      return_url:,
      callback_url:,
      tx_ref:,
      title: "Renewal: #{@subscription.link.name}".truncate(50),
      description: "Subscription renewal for #{@subscription.external_id}"
    )

    if init_result[:success]
      checkout_url = init_result[:checkout_url]
      respond_to do |format|
        format.html { redirect_to checkout_url, allow_other_host: true }
        format.json { render json: { success: true, checkout_url:, tx_ref: } }
      end
    else
      respond_to do |format|
        format.html { redirect_to manage_subscription_path(@subscription.external_id), alert: t("flash.subscriptions.payment_initiate_failed", error: init_result[:error]) }
        format.json { render json: { success: false, error: init_result[:error] }, status: :unprocessable_entity }
      end
    end
  end

  def manage
    product = @subscription.link
    @body_id = "product_page"

    set_meta_tag(title: @subscription.is_installment_plan ? t("manage_installment_plan") : t("manage_membership"))
    set_product_page_meta(product)

    props = CheckoutPresenter.new(logged_in_user:, ip: request.remote_ip)
              .subscription_manager_props(subscription: @subscription)
    return e404 if props.nil?

    set_subscription_confirmed_redirect_cookie

    render inertia: "Subscriptions/Manage", props: props
  end

  private
    def check_can_manage
      (@subscription = Subscription.find_by_external_id(params[:id])) || e404
      e404 if @subscription.ended?
      e404 if @subscription.is_installment_plan? && @subscription.charges_completed?
      cookie = cookies.encrypted[@subscription.cookie_key]
      return if cookie.present? && ActiveSupport::SecurityUtils.secure_compare(cookie, @subscription.external_id)
      return if user_signed_in? && logged_in_user.is_team_member?
      return if user_signed_in? && logged_in_user == @subscription.user
      return if user_signed_in? && gifter_user.present? && logged_in_user == gifter_user
      token = params[:token]
      if token.present?
        return if @subscription.token.present? && ActiveSupport::SecurityUtils.secure_compare(token, @subscription.token) && @subscription.token_expires_at > Time.current
        return redirect_to new_subscription_magic_link_path(params[:id], invalid: true)
      end

      respond_to do |format|
        format.html { redirect_to new_subscription_magic_link_path(params[:id]) }
        format.json { render json: { success: false, redirect_to: new_subscription_magic_link_path(params[:id]) } }
      end
    end

    def gifter_user
      return unless @subscription.gift?
      @subscription.true_original_purchase.gift_given&.gifter_purchase&.purchaser
    end

    def set_subscription_confirmed_redirect_cookie
      cookies.encrypted[@subscription.cookie_key] = {
        value: @subscription.external_id,
        httponly: true,
        expires: Rails.env.test? ? nil : SUBSCRIPTION_COOKIE_EXPIRY.from_now
      }
    end

    def fetch_subscription
      @subscription = Subscription.find_by_external_id(params[:id] || params[:subscription_id])
      render json: { success: false } if @subscription.nil?
    end
end
