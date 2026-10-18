# frozen_string_literal: true

# The admin web UI was deleted; admin operations run through the internal
# admin API (api/internal/admin) consumed by the gumroad-admin CLI. What
# remains here: GET impersonate (Helper/CLI links), the Stripe dashboard
# redirect, and the team-member-gated Sidekiq/Flipper mounts.
namespace :admin do
  root to: "overview#index"

  get :impersonate, to: "base#impersonate"
  delete :unimpersonate, to: "base#unimpersonate"
  get :redirect_to_stripe_dashboard, to: "base#redirect_to_stripe_dashboard", as: :redirect_to_stripe_dashboard

  resources :orders, only: [:index, :show] do
    member do
      post :resend_receipt
      post :refund
      post :cancel_subscription
      post :reverify
    end
  end

  resources :creators, only: [:index, :show] do
    member do
      post :suspend
      post :unsuspend
    end
  end

  resources :payouts, only: [:index, :show] do
    member do
      post :mark_paid
      post :cancel
    end
  end

  resources :activity_logs, only: [:index, :show], path: "activity-log"

  resources :team_members, only: [:index, :show], path: "team" do
    member do
      post :revoke
    end
  end

  resources :products, only: [:index, :show] do
    member do
      post :unpublish
      post :publish
    end
  end

  resources :subscriptions, only: [:index, :show] do
    member do
      post :cancel
    end
  end

  resources :customers, only: [:index, :show]

  get "marketing", to: "marketing#index"
  get "reports", to: "reports#index"

  constraints(lambda { |request| request.env["warden"].authenticate? && request.env["warden"].user.is_team_member? }) do
    mount SidekiqWebCSP.new(Sidekiq::Web) => :sidekiq, as: :sidekiq_web
    mount FlipperCSP.new(Flipper::UI.app(Flipper)) => :features, as: :flipper_ui
  end
end
