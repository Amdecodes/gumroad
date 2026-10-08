# frozen_string_literal: true

class Settings::SocialConnectionsController < Settings::BaseController
  include SocialConnectReturn

  before_action :ensure_enabled
  before_action :authorize

  def show
    set_meta_tag(title: "Social connections")
    render inertia: "Settings/SocialConnections/Show",
           props: settings_presenter.social_connections_props.merge(social_connect_return: prepare_social_connect_return)
  end

  private
    def authorize
      super([:settings, :social_connections])
    end

    def ensure_enabled
      redirect_to settings_main_path unless Flipper.enabled?(:social_connections)
    end
end
