# frozen_string_literal: true

class LocalesController < ApplicationController
  skip_before_action :verify_authenticity_token, if: -> { request.format.json? || request.get? }

  def update
    target = (params[:locale] || params[:id]).to_s.downcase
    resolved = I18n.available_locales.map(&:to_s).include?(target) ? target : I18n.default_locale.to_s

    I18n.locale = resolved.to_sym
    cookies[:locale] = {
      value: resolved,
      expires: 1.year.from_now,
      httponly: false
    }

    if logged_in_user.present?
      logged_in_user.update_column(:locale, resolved)
    end

    respond_to do |format|
      format.json { render json: { success: true, locale: resolved } }
      format.html do
        redirect_back(fallback_location: root_path)
      end
    end
  end
end
