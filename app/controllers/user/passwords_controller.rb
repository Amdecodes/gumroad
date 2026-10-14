# frozen_string_literal: true

class User::PasswordsController < Devise::PasswordsController
  include InertiaRendering, PageMeta::Base

  before_action :set_default_page_title
  before_action :set_csrf_meta_tags
  before_action :set_default_meta_tags
  helper_method :erb_meta_tags

  layout "inertia", only: [:new, :edit]

  def new
    set_meta_tag(title: "Forgot password")
    auth_presenter = AuthPresenter.new(params:, application: @application)
    render inertia: "User/Passwords/New", props: auth_presenter.login_props
  end

  def create
    email = params.dig(:user, :email)
    user = User.alive.by_email(email).first if EmailFormatValidator.valid?(email)

    if user&.send_reset_password_instructions
      redirect_to login_url, notice: t("flash.passwords.reset_sent"), status: :see_other
    else
      redirect_back fallback_location: login_url, warning: t("flash.passwords.account_not_found")
    end
  end

  def edit
    reset_password_token = params[:reset_password_token]
    user = User.find_or_initialize_with_error_by(:reset_password_token,
                                                 Devise.token_generator.digest(User, :reset_password_token, reset_password_token))
    if user.errors.present?
      return redirect_to root_path, warning: t("flash.passwords.invalid_token")
    end

    set_meta_tag(title: "Reset your password")
    render inertia: "User/Passwords/Edit", props: {
      reset_password_token: reset_password_token
    }
  end

  def update
    reset_password_token = params[:user][:reset_password_token]
    user = User.reset_password_by_token(params[:user])

    if user.errors.present?
      error_message = if user.errors[:password_confirmation].present?
        t("flash.passwords.passwords_do_not_match")
      elsif user.errors[:password].present?
        user.errors.full_messages.first
      else
        t("flash.passwords.invalid_token")
      end
      redirect_to edit_user_password_path(reset_password_token: reset_password_token), warning: error_message
    else
      user.invalidate_active_sessions!
      if user.deleted?
        redirect_to root_path, status: :see_other, notice: t("flash.passwords.reset_success")
      else
        sign_in_or_prepare_for_two_factor_auth(user)

        if session[:verify_two_factor_auth_for] == user.id
          redirect_to two_factor_authentication_path(next: root_path), status: :see_other,
                                                                       notice: t("flash.passwords.reset_two_factor")
        else
          redirect_to root_path, status: :see_other, notice: t("flash.passwords.reset_logged_in")
        end
      end
    end
  end

  def after_sending_reset_password_instructions_path_for(_resource_name, _user)
    root_url
  end
end
