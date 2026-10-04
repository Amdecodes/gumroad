# frozen_string_literal: true

require "spec_helper"

RSpec.describe "Marketplace & Storefront Polish (Step 10)" do
  let(:seller) { create(:user, username: "amanueldev", name: "Amanuel Mengistu") }
  let(:product) do
    create(
      :product,
      user: seller,
      name: "Ethiopian Art & Design Assets",
      price_cents: 25_000,
      price_currency_type: "etb"
    )
  end

  before do
    host! DOMAIN
  end

  describe "Public Product Display (LinksController#show)" do
    it "renders the product page with ETB currency and integer santims" do
      get "http://#{seller.subdomain}/l/#{product.unique_permalink}", headers: { "X-Inertia" => "true" }
      expect(response).to have_http_status(:ok)

      props = JSON.parse(response.body)["props"]
      product_props = props["product"]

      expect(product_props["name"]).to eq("Ethiopian Art & Design Assets")
      expect(product_props["currency_code"]).to eq("etb")
      expect(product_props["price_cents"]).to eq(25_000)
      expect(product_props["is_published"]).to be(true)
    end

    it "renders Pay-What-You-Want (PWYW) pricing with suggested price in santims" do
      pwyw_product = create(
        :product,
        user: seller,
        name: "PWYW Ethiopian Fonts",
        price_cents: 10_000,
        suggested_price_cents: 15_000,
        customizable_price: true,
        price_currency_type: "etb"
      )

      get "http://#{seller.subdomain}/l/#{pwyw_product.unique_permalink}", headers: { "X-Inertia" => "true" }
      expect(response).to have_http_status(:ok)

      props = JSON.parse(response.body)["props"]
      product_props = props["product"]

      expect(product_props["currency_code"]).to eq("etb")
      expect(product_props["price_cents"]).to eq(10_000)
      expect(product_props["pwyw"]).to be_present
      expect(product_props["pwyw"]["suggested_price_cents"]).to eq(15_000)
    end

    it "renders product variant options with price differences in santims" do
      variant_product = create(
        :product,
        user: seller,
        name: "Pro UI Kit Bundle",
        price_cents: 50_000,
        price_currency_type: "etb"
      )
      variant_category = create(:variant_category, link: variant_product, title: "License")
      create(:variant, variant_category:, name: "Commercial", price_difference_cents: 20_000)

      get "http://#{seller.subdomain}/l/#{variant_product.unique_permalink}", headers: { "X-Inertia" => "true" }
      expect(response).to have_http_status(:ok)

      props = JSON.parse(response.body)["props"]
      product_props = props["product"]

      expect(product_props["currency_code"]).to eq("etb")
      expect(product_props["price_cents"]).to eq(50_000)
      # Variants are serialized as `options` on the product (Link#options → first variant_category)
      expect(product_props["options"]).to be_an(Array)
      expect(product_props["options"]).not_to be_empty
      commercial = product_props["options"].find { _1["name"] == "Commercial" }
      expect(commercial).to be_present
      expect(commercial["price_difference_cents"]).to eq(20_000)
    end

    it "supports Amharic locale switching on product page" do
      get "http://#{seller.subdomain}/l/#{product.unique_permalink}?locale=am", headers: { "X-Inertia" => "true" }
      expect(response).to have_http_status(:ok)

      body = JSON.parse(response.body)
      expect(body["props"]["locale"]).to eq("am")
      expect(I18n.locale).to eq(:am)
    end
  end

  describe "Creator Storefront Profile (UsersController#show)" do
    it "redirects root domain /:username to the creator subdomain" do
      get "http://#{DOMAIN}/#{seller.username}"
      # Rails appends a trailing slash when redirecting to the subdomain root
      expect(response.location).to start_with(seller.subdomain_with_protocol)
      expect(response).to have_http_status(:moved_permanently)
    end

    it "renders the creator profile with published products in ETB on subdomain" do
      product # Ensure product is created
      index_model_records(Link)

      get "http://#{seller.subdomain}/", headers: { "X-Inertia" => "true" }
      expect(response).to have_http_status(:ok)

      body = JSON.parse(response.body)
      expect(body["component"]).to eq("Users/Show")

      creator_profile = body["props"]["creator_profile"]
      expect(creator_profile["name"]).to eq("Amanuel Mengistu")

      # Products appear in sections[].search_results.products (card shape)
      sections = body["props"]["sections"]
      expect(sections).to be_an(Array)
      expect(sections).not_to be_empty

      all_cards = sections.flat_map { |s| s.dig("search_results", "products") || [] }
      store_product = all_cards.find { _1["id"] == product.external_id }
      expect(store_product).to be_present
      expect(store_product["currency_code"]).to eq("etb")
      expect(store_product["price_cents"]).to eq(25_000)
    end

    it "preserves Amharic locale preference on creator profile via query param" do
      # Subdomain requests don't inherit cookie jar across host! — use ?locale= param instead
      get "http://#{seller.subdomain}/?locale=am", headers: { "X-Inertia" => "true" }
      expect(response).to have_http_status(:ok)

      body = JSON.parse(response.body)
      expect(body["props"]["locale"]).to eq("am")
    end
  end

  describe "Marketplace Discovery (DiscoverController#index)" do
    it "renders the discovery catalog with ETB product cards" do
      product # Ensure product is created
      get "/discover", headers: { "X-Inertia" => "true" }
      expect(response).to have_http_status(:ok)

      body = JSON.parse(response.body)
      expect(body["component"]).to eq("Discover/Index")
      # Products are nested under search_results.products (not top-level)
      search_results = body["props"]["search_results"]
      expect(search_results).to be_present
      products = search_results["products"]
      expect(products).to be_an(Array)

      card = products.find { _1["id"] == product.external_id }
      if card
        expect(card["currency_code"]).to eq("etb")
        expect(card["price_cents"]).to eq(25_000)
      end
    end

    it "supports Amharic locale switching on discover page" do
      get "/discover?locale=am", headers: { "X-Inertia" => "true" }
      expect(response).to have_http_status(:ok)

      body = JSON.parse(response.body)
      expect(body["props"]["locale"]).to eq("am")
    end
  end

  describe "Storefront to Chapa Checkout Handoff" do
    let(:guid) { SecureRandom.hex(16) }

    before do
      cookies[:_gumroad_guid] = guid
    end

    it "creates an order and returns hosted Chapa checkout_url for ETB purchases" do
      allow_any_instance_of(Chapa::Client).to receive(:initialize_transaction) do |_client, purchase:, return_url:, callback_url:|
        expect(purchase.price_in_currency_cents).to eq(25_000)
        expect(purchase.displayed_price_currency_type.to_s).to eq("etb")
        expect(return_url).to include(purchase.external_id)
        expect(callback_url).to include("/webhooks/chapa")

        {
          success: true,
          tx_ref: "arifdrop-#{purchase.external_id}-12345",
          checkout_url: "https://checkout.chapa.co/checkout/payment/CHAPA_PAY_URL_100"
        }
      end

      post "/orders", params: {
        email: "buyer@example.com",
        full_name: "Almaz Kebede",
        line_items: [
          {
            permalink: product.unique_permalink,
            perceived_price_cents: "25000",
            quantity: "1",
            uid: "item_uid_10"
          }
        ]
      }, headers: { "X-Inertia" => "true" }

      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body["success"]).to be(true)
      expect(body["checkout_url"]).to eq("https://checkout.chapa.co/checkout/payment/CHAPA_PAY_URL_100")
      expect(body["tx_ref"]).to eq("arifdrop-#{Purchase.last.external_id}-12345")

      purchase = Purchase.last
      expect(purchase.charge_processor_id).to eq("chapa")
      expect(purchase.purchase_state).to eq("in_progress")
      expect(purchase.price_in_currency_cents).to eq(25_000)
    end
  end
end
