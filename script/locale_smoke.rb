#!/usr/bin/env ruby
# frozen_string_literal: true

#
# locale_smoke.rb — Localization smoke test for pseudo-locale & Amharic layout
#
# Usage:
#   bundle exec ruby script/locale_smoke.rb

require "bundler/setup"

ENV["RAILS_ENV"] ||= "development"
ENV["VITE_RUBY_DEV_SERVER_ENABLED"] = "false"
ENV["DISABLE_SPRING"] = "1"

begin
  require_relative "../config/environment"
rescue => e
  warn "Browser smoke unavailable: Rails environment failed to load — #{e.message}."
  warn ""
  warn "Route list for manual testing:"
  puts <<~ROUTES
    [Public]
      /discover?locale=pseudo
      /login?locale=pseudo
    [Buyer]
      /library?locale=pseudo
      /settings/profile?locale=pseudo
    [Seller]
      /dashboard?locale=pseudo
      /products?locale=pseudo
      /analytics?locale=pseudo
      /settings/profile?locale=pseudo
      /settings/payments?locale=pseudo
    [Admin]
      /admin?locale=pseudo
      /admin/creators?locale=pseudo
      /admin/orders?locale=pseudo
      /admin/payouts?locale=pseudo
    [Amharic Screenshots (375px & 1280px)]
      /discover?locale=am
      /login?locale=am
      /library?locale=am
      /dashboard?locale=am
      /products?locale=am
      /admin?locale=am
  ROUTES
  exit 1
end

# Ensure 127.0.0.1 and localhost match domain constraints
VALID_REQUEST_HOSTS << "127.0.0.1" unless VALID_REQUEST_HOSTS.include?("127.0.0.1")
VALID_REQUEST_HOSTS << "localhost" unless VALID_REQUEST_HOSTS.include?("localhost")

# Disable external asset host so Capybara serves assets locally from Puma
Rails.application.config.asset_host = nil
ActionController::Base.asset_host = nil

require "capybara"
require "capybara/dsl"
require "selenium-webdriver"
require "timeout"

Capybara.register_driver :locale_smoke do |app|
  options = Selenium::WebDriver::Chrome::Options.new
  options.add_argument("--headless=new")
  options.add_argument("--no-sandbox")
  options.add_argument("--disable-dev-shm-usage")
  options.add_argument("--disable-gpu")
  options.add_argument("--window-size=1280,900")
  options.binary = "/usr/bin/google-chrome" if File.exist?("/usr/bin/google-chrome")
  Capybara::Selenium::Driver.new(app, browser: :chrome, options:)
end

Capybara.default_driver        = :locale_smoke
Capybara.default_max_wait_time = 15
Capybara.app                   = Rails.application
Capybara.server                = :puma, { Silent: true }
Capybara.server_host           = "127.0.0.1"

class LocaleSmokeRunner
  include Capybara::DSL

  SCREENSHOT_DIR = Rails.root.join("tmp/locale_screenshots").freeze

  FIND_UNTRANSLATED_JS = <<~JS
    (function() {
      var walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        {
          acceptNode: function(node) {
            var parent = node.parentElement;
            if (!parent) return NodeFilter.FILTER_REJECT;
            var tag = parent.tagName.toLowerCase();
            if (['script', 'style', 'noscript', 'template', 'svg'].includes(tag))
              return NodeFilter.FILTER_REJECT;
            if (parent.closest && parent.closest('.profiler-results, .profiler-queries, .rack-mini-profiler, #bullet-footer, #bullet-alerts, .bullet-warning, [id*="bullet"]'))
              return NodeFilter.FILTER_REJECT;
            var style = window.getComputedStyle(parent);
            if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0')
              return NodeFilter.FILTER_REJECT;
            return NodeFilter.FILTER_ACCEPT;
          }
        }
      );

      var untranslated = [];
      var node;
      while ((node = walker.nextNode())) {
        var text = node.textContent.trim();
        // Skip blank, single-char, or purely non-alpha content (numbers, punctuation)
        if (!text || text.length < 2) continue;
        if (!/[a-zA-Z]{2,}/.test(text)) continue;
        // If the text contains the pseudo marker ⟦ (\u27E6), it's translated!
        if (text.indexOf('\u27E6') !== -1) continue;
        untranslated.push(text);
      }

      // Deduplicate preserving first occurrence
      return untranslated.filter(function(v, i, a) { return a.indexOf(v) === i; });
    })();
  JS

  CHECK_LAYOUT_JS = <<~JS
    (function() {
      var issues = [];

      // 1. Horizontal viewport overflow
      var docWidth = Math.max(
        document.documentElement.scrollWidth,
        document.body ? document.body.scrollWidth : 0
      );
      var viewportWidth = window.innerWidth;
      if (docWidth > viewportWidth + 4) {
        issues.push({
          type: "horizontal_overflow",
          detail: "Document scrollWidth (" + docWidth + "px) exceeds viewport (" + viewportWidth + "px) by " + (docWidth - viewportWidth) + "px"
        });
      }

      // 2. Clipped text elements (overflow: hidden with scrollWidth > clientWidth)
      var elements = document.querySelectorAll('button, a, h1, h2, h3, h4, h5, h6, span, p, label, th, td');
      for (var i = 0; i < elements.length; i++) {
        var el = elements[i];
        if (el.children.length > 2) continue;
        var style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden') continue;
        if (style.overflow === 'hidden' || style.overflowX === 'hidden' || style.textOverflow === 'ellipsis') {
          if (el.scrollWidth > el.clientWidth + 2 && el.clientWidth > 0) {
            issues.push({
              type: "text_clipped",
              tag: el.tagName.toLowerCase(),
              text: el.textContent.trim().substring(0, 50),
              clientWidth: el.clientWidth,
              scrollWidth: el.scrollWidth
            });
          }
        }
      }
      return issues;
    })();
  JS

  BUYER_EMAIL   = "gumbuyer0@gumroad.com"
  SELLER_EMAIL  = "seller@gumroad.com"
  PASSWORD      = "password"

  def run
    FileUtils.mkdir_p(SCREENSHOT_DIR)

    buyer  = User.find_by(email: BUYER_EMAIL)
    seller = User.find_by(email: SELLER_EMAIL)

    if buyer.nil? || seller.nil?
      warn "Seeded users not found in database. Run: bundle exec rails db:seed"
      exit 1
    end

    # Pre-authorize localhost IP for 2FA to prevent OTP challenges during automated smoke
    buyer.add_two_factor_authenticated_ip!("127.0.0.1")
    seller.add_two_factor_authenticated_ip!("127.0.0.1")

    puts "============================================================"
    puts "Localization Verification: Browser Smoke Script"
    puts "============================================================"
    puts "Found seeded buyer:  #{buyer.email}"
    puts "Found seeded seller: #{seller.email}"
    puts "Found seeded admin:  #{seller.email} (is_team_member: #{seller.is_team_member?})"
    puts

    persona_routes = [
      {
        role: "Public",
        login: false,
        routes: [
          "/discover?locale=pseudo",
          "/login?locale=pseudo"
        ]
      },
      {
        role: "Buyer",
        login: true,
        email: BUYER_EMAIL,
        routes: [
          "/library?locale=pseudo",
          "/settings/profile?locale=pseudo"
        ]
      },
      {
        role: "Seller",
        login: true,
        email: SELLER_EMAIL,
        routes: [
          "/dashboard?locale=pseudo",
          "/products?locale=pseudo",
          "/analytics?locale=pseudo",
          "/settings/profile?locale=pseudo",
          "/settings/payments?locale=pseudo"
        ]
      },
      {
        role: "Admin",
        login: true,
        email: SELLER_EMAIL,
        routes: [
          "/admin?locale=pseudo",
          "/admin/creators?locale=pseudo",
          "/admin/orders?locale=pseudo",
          "/admin/payouts?locale=pseudo"
        ]
      }
    ]

    untranslated_report = {}
    all_layout_issues   = {}

    puts "------------------------------------------------------------"
    puts "Phase 1: Pseudo-Locale Scanning (?locale=pseudo)"
    puts "------------------------------------------------------------"

    persona_routes.each do |persona|
      puts "\n[Persona: #{persona[:role]}]"
      if persona[:login]
        login_user(persona[:email], PASSWORD)
      else
        logout_user
      end

      persona[:routes].each do |route|
        print "  Scanning #{route} ... "
        visit_route(route)
        raw = page.evaluate_script(FIND_UNTRANSLATED_JS)
        texts = raw.is_a?(Array) ? raw : []
        untranslated_report[route] = texts
        puts "#{texts.empty? ? '✓ 0 untranslated' : "✗ #{texts.size} untranslated"}"
        texts.first(10).each { |t| puts "      • #{t}" }
        puts "      ... and #{texts.size - 10} more" if texts.size > 10
      end
    end

    puts "\n------------------------------------------------------------"
    puts "Phase 2: Amharic Screenshots & Layout Checks (?locale=am)"
    puts "------------------------------------------------------------"

    screenshot_routes = [
      { role: "Public", login: false, route: "/discover?locale=am", label: "discover_am" },
      { role: "Public", login: false, route: "/login?locale=am",    label: "login_am" },
      { role: "Buyer",  login: true,  email: BUYER_EMAIL,  route: "/library?locale=am",   label: "buyer_library_am" },
      { role: "Seller", login: true,  email: SELLER_EMAIL, route: "/dashboard?locale=am", label: "seller_dashboard_am" },
      { role: "Seller", login: true,  email: SELLER_EMAIL, route: "/products?locale=am",  label: "seller_products_am" },
      { role: "Admin",  login: true,  email: SELLER_EMAIL, route: "/admin?locale=am",     label: "admin_overview_am" }
    ]

    saved_screenshots = []

    screenshot_routes.each do |item|
      puts "\n[#{item[:role]}] #{item[:route]}"
      if item[:login]
        login_user(item[:email], PASSWORD)
      else
        logout_user
      end

      [375, 1280].each do |width|
        file, issues = screenshot_at(item[:route], item[:label], width)
        if file
          saved_screenshots << file
          puts "  📷 #{width}px -> #{file.basename}"
        end
        if issues.any?
          all_layout_issues["#{item[:route]} @ #{width}px"] = issues
          puts "     ⚠️  #{issues.size} layout issue(s) detected:"
          issues.first(5).each do |issue|
            if issue["type"] == "horizontal_overflow"
              puts "        - Horizontal overflow: #{issue['detail']}"
            else
              puts "        - Text clipped in <#{issue['tag']}>: \"#{issue['text']}\" (client: #{issue['clientWidth']}px, scroll: #{issue['scrollWidth']}px)"
            end
          end
        end
      end
    end

    puts "\n============================================================"
    puts "Final Localization Verification Summary"
    puts "============================================================"
    total_untranslated = untranslated_report.values.sum(&:size)
    puts "Total routes checked: #{untranslated_report.size}"
    puts "Total untranslated text nodes: #{total_untranslated}"
    puts "Total screenshots captured:   #{saved_screenshots.size}"
    puts "Total layout issues detected: #{all_layout_issues.values.sum(&:size)}"
    puts
    puts "Untranslated text by route:"
    untranslated_report.each do |route, texts|
      status = texts.empty? ? "✓ OK" : "✗ #{texts.size} untranslated"
      puts "  #{status.ljust(22)} #{route}"
    end

    if all_layout_issues.any?
      puts "\nLayout / Clipping Issues:"
      all_layout_issues.each do |context, issues|
        puts "  #{context}:"
        issues.each do |issue|
          puts "    • [#{issue['type']}] #{issue['detail'] || "#{issue['tag']}: #{issue['text']}"}"
        end
      end
    else
      puts "\n✓ No layout overflow or clipping detected."
    end

    puts "\nScreenshots directory: #{SCREENSHOT_DIR}/"
  end

  private
    def wait_for_page_ready
      Timeout.timeout(Capybara.default_max_wait_time) do
        sleep 0.1 until page.evaluate_script("document.readyState") == "complete"
      end

      # Wait for Inertia / React to mount if #app is present
      Timeout.timeout(Capybara.default_max_wait_time) do
        sleep 0.1 until page.evaluate_script(<<~JS)
        (function() {
          var app = document.getElementById('app');
          if (!app) return true;
          return app.children.length > 0;
        })()
        JS
      end

      sleep 0.3
    rescue
      # Continue even if wait times out
    end

    def visit_route(route)
      visit route
      wait_for_page_ready
    end

    def login_user(email, password)
      logout_user
      visit "/login"
      wait_for_page_ready

      if page.has_css?('input[type="email"]', wait: 5)
        find('input[type="email"]').set(email)
        find('input[type="password"]').set(password)
        find('button[type="submit"]').click
        Timeout.timeout(10) { sleep 0.1 until page.current_path != "/login" } rescue nil
        wait_for_page_ready
        puts "  ✓ Logged in as #{email} (current path: #{page.current_path})"
      else
        warn "  ✗ Could not find login form inputs for #{email}"
      end
    rescue => e
      warn "  ✗ Login error for #{email}: #{e.message}"
    end

    def logout_user
      visit "/logout"
      wait_for_page_ready
    rescue => e
      warn "  ✗ Logout error: #{e.message}"
    end

    def screenshot_at(route, label, width)
      page.driver.browser.manage.window.resize_to(width, 900)
      visit_route(route)
      slug = label.gsub(/[^a-z0-9_-]/i, "_")
      file = SCREENSHOT_DIR.join("#{slug}_#{width}w.png")
      page.save_screenshot(file.to_s)
      layout_issues = page.evaluate_script(CHECK_LAYOUT_JS) || []
      [file, layout_issues]
    rescue => e
      warn "  ✗ Screenshot failed for #{route} @ #{width}px: #{e.message}"
      [nil, []]
    end
end

LocaleSmokeRunner.new.run
