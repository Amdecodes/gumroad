#!/usr/bin/env ruby
# frozen_string_literal: true

#
# locale_smoke.rb — Localization smoke test for pseudo-locale & Amharic layout
#
# Usage:
#   bundle exec ruby script/locale_smoke.rb

require "bundler/setup"
require "digest"
require "set"

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
      /settings/payments?locale=am
      /admin?locale=am
  ROUTES
  exit 1
end

# Ensure 127.0.0.1 and localhost match domain constraints
VALID_REQUEST_HOSTS << "127.0.0.1" unless VALID_REQUEST_HOSTS.include?("127.0.0.1")
VALID_REQUEST_HOSTS << "localhost" unless VALID_REQUEST_HOSTS.include?("localhost")

# Disable external asset host so Capybara serves assets locally from Puma
module NoAssetHostHelper
  def compute_asset_host(source = "", options = {})
    nil
  end
end
ActionView::Base.prepend(NoAssetHostHelper)
ActionView::Helpers::AssetUrlHelper.prepend(NoAssetHostHelper)

Rails.application.reloader.to_prepare do
  Rails.application.config.asset_host = nil
  Rails.application.config.action_controller.asset_host = nil
  ActionController::Base.config.asset_host = nil
  ApplicationController.config.asset_host = nil
  ActionView::Base.prepend(NoAssetHostHelper)
  ActionView::Helpers::AssetUrlHelper.prepend(NoAssetHostHelper)
end

ApplicationController.config.asset_host = nil
ActionController::Base.config.asset_host = nil
ActionController::Base.asset_host = nil
Rails.application.config.action_controller.asset_host = nil
Rails.application.config.asset_host = nil
cfg = ViteRuby.instance.config.instance_variable_get(:@config).dup
cfg["asset_host"] = nil
ViteRuby.instance.config.instance_variable_set(:@config, cfg.freeze)
ViteRuby.instance.config.define_singleton_method(:asset_host) { nil }

# Sanitize baked-in asset host in Vite chunks for headless Capybara
Dir.glob(Rails.root.join("public/vite-dev/assets/*.js")).each do |file|
  content = File.read(file)
  if content.include?("http://app.localhost:3000/vite-dev/")
    File.write(file, content.gsub("http://app.localhost:3000/vite-dev/", "/vite-dev/"))
  end
end

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
  options.add_argument("--disable-background-networking")
  options.add_argument("--disable-default-apps")
  options.add_argument("--disable-sync")
  options.add_argument("--disable-translate")
  options.add_argument("--disable-extensions")
  options.add_argument("--metrics-recording-only")
  options.add_argument("--mute-audio")
  options.binary = "/usr/bin/google-chrome" if File.exist?("/usr/bin/google-chrome")
  Capybara::Selenium::Driver.new(app, browser: :chrome, options:)
end

Capybara.default_driver        = :locale_smoke
Capybara.default_max_wait_time = 10
Capybara.app                   = Rails.application
Capybara.server                = :puma, { Silent: true }
Capybara.server_host           = "127.0.0.1"

class LocaleSmokeRunner
  include Capybara::DSL

  SCREENSHOT_DIR = Rails.root.join("tmp/locale_screenshots").freeze

  KNOWN_CANONICAL_REDIRECTS = {
    "/settings/profile" => "/profile",
    "/analytics" => "/dashboard/sales"
  }.freeze

  FIND_UNTRANSLATED_JS = <<~JS
    (function() {
      var untranslated = [];

      // 1. Check document title
      var pageTitle = document.title ? document.title.trim() : '';
      if (pageTitle && /[a-zA-Z]{2,}/.test(pageTitle) && pageTitle.indexOf('\u27E6') === -1) {
        untranslated.push("[title] " + pageTitle);
      }

      // 2. Check input and textarea placeholders
      var inputs = document.querySelectorAll('input[placeholder], textarea[placeholder]');
      inputs.forEach(function(el) {
        var ph = el.getAttribute('placeholder') ? el.getAttribute('placeholder').trim() : '';
        if (ph && /[a-zA-Z]{2,}/.test(ph) && ph.indexOf('\u27E6') === -1) {
          untranslated.push("[placeholder] " + ph);
        }
      });

      // 3. Check interactive element aria-labels
      var labeled = document.querySelectorAll('button[aria-label], a[aria-label], input[aria-label]');
      labeled.forEach(function(el) {
        var aria = el.getAttribute('aria-label') ? el.getAttribute('aria-label').trim() : '';
        if (aria && /[a-zA-Z]{2,}/.test(aria) && aria.indexOf('\u27E6') === -1) {
          if (!aria.includes('://') && !aria.includes('@') && !/^\\d/.test(aria)) {
            untranslated.push("[aria-label] " + aria);
          }
        }
      });

      // 4. Walk DOM text nodes, excluding user/product data
      var walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        {
          acceptNode: function(node) {
            var parent = node.parentElement;
            if (!parent) return NodeFilter.FILTER_REJECT;
            var tag = parent.tagName.toLowerCase();
            if (['script', 'style', 'noscript', 'template', 'svg', 'pre', 'code'].includes(tag))
              return NodeFilter.FILTER_REJECT;
            if (parent.closest && parent.closest('.profiler-results, .profiler-queries, .rack-mini-profiler, #bullet-footer, #bullet-alerts, .bullet-warning, [id*="bullet"]'))
              return NodeFilter.FILTER_REJECT;

            // Reject user-generated product / buyer / seller data containers
            if (parent.closest) {
              // Product cards: exclude product name, author byline, description
              var inProductCard = parent.closest('article, [data-component="product-card"], [data-testid="product-card"]');
              if (inProductCard && !parent.closest('button, [role="button"], .ribbon')) {
                return NodeFilter.FILTER_REJECT;
              }
              // Schema.org data markup
              if (parent.closest('[itemprop="name"], [itemprop="author"], [itemprop="description"], [itemprop="review"], [itemprop="reviewBody"]')) {
                return NodeFilter.FILTER_REJECT;
              }
              // RTL user content or user bio
              if (parent.closest('[dir="auto"], [data-testid="user-bio"], .user-bio, .creator-bio')) {
                return NodeFilter.FILTER_REJECT;
              }
              // Wishlist user data
              if (parent.closest('[data-wishlist] h2, [data-wishlist] h3, [data-wishlist] p')) {
                return NodeFilter.FILTER_REJECT;
              }
            }

            var style = window.getComputedStyle(parent);
            if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0')
              return NodeFilter.FILTER_REJECT;
            return NodeFilter.FILTER_ACCEPT;
          }
        }
      );

      var node;
      while ((node = walker.nextNode())) {
        var text = node.textContent.trim();
        // Skip blank, single-char, or purely non-alpha content (numbers, punctuation)
        if (!text || text.length < 2) continue;
        if (!/[a-zA-Z]{2,}/.test(text)) continue;
        // Skip email addresses, URLs, pure numbers/currencies/percentages
        if (text.includes('@') && text.includes('.')) continue;
        if (text.includes('://')) continue;
        if (/^\\$?\\d+[\\d,\\.]*\\s*[%\\+]?$/i.test(text)) continue;
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
          key: "horizontal_viewport_overflow",
          type: "horizontal_overflow",
          detail: "Document scrollWidth (" + docWidth + "px) exceeds viewport (" + viewportWidth + "px) by " + (docWidth - viewportWidth) + "px"
        });
      }

      // Structural DOM signature for cross-locale comparison
      function getSignature(el) {
        var path = [];
        var curr = el;
        while (curr && curr !== document.body && curr !== document.documentElement) {
          var tag = curr.tagName.toLowerCase();
          var idx = 0;
          if (curr.parentElement) {
            for (var i = 0; i < curr.parentElement.children.length; i++) {
              if (curr.parentElement.children[i] === curr) { idx = i; break; }
            }
          }
          var id = curr.id ? ('#' + curr.id) : '';
          path.unshift(tag + id + ':nth-child(' + (idx + 1) + ')');
          curr = curr.parentElement;
        }
        return path.join(' > ');
      }

      // 2. Clipped elements
      var elements = document.querySelectorAll('button, a, h1, h2, h3, h4, h5, h6, span, p, label, th, td, div');
      for (var i = 0; i < elements.length; i++) {
        var el = elements[i];
        if (el.children.length > 2) continue;
        var style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden') continue;

        var isButtonOrLabel = el.matches('button, label, [role="button"], input[type="button"], input[type="submit"]') ||
                              el.closest('button, label, [role="button"]') !== null;

        var hasEllipsis = style.textOverflow === 'ellipsis';
        var hasOverflowHidden = style.overflow === 'hidden' || style.overflowX === 'hidden';

        // Ignore intended text-overflow: ellipsis unless it hides a button or form label
        if (hasEllipsis && !isButtonOrLabel) {
          continue;
        }

        if (hasEllipsis || hasOverflowHidden) {
          if (el.scrollWidth > el.clientWidth + 2 && el.clientWidth > 0) {
            var sig = getSignature(el);
            issues.push({
              key: sig,
              type: "text_clipped",
              tag: el.tagName.toLowerCase(),
              text: el.textContent.trim().substring(0, 50),
              clientWidth: el.clientWidth,
              scrollWidth: el.scrollWidth,
              isButtonOrLabel: isButtonOrLabel
            });
          }
        }
      }
      return issues;
    })();
  JS

  BUYER_EMAIL   = "gumbuyer0@gumroad.com"
  SELLER_EMAIL  = "seller@gumroad.com"
  ADMIN_EMAIL   = "admin@gumroad.com"
  PASSWORD      = "password"

  def run
    FileUtils.mkdir_p(SCREENSHOT_DIR)

    buyer  = User.find_by(email: BUYER_EMAIL)
    seller = User.find_by(email: SELLER_EMAIL)
    admin  = User.find_by(email: ADMIN_EMAIL)

    if admin.nil?
      admin = User.new(
        email: ADMIN_EMAIL,
        name: "Gumroad Admin",
        username: "gumadmin",
        confirmed_at: Time.current,
        is_team_member: true,
        user_risk_state: "compliant",
        password: PASSWORD
      )
      admin.save!(validate: false)
    end

    if buyer.nil? || seller.nil?
      warn "Seeded buyer/seller not found in database. Run: bundle exec rails db:seed"
      exit 1
    end

    # Pre-authorize localhost IP for 2FA to prevent OTP challenges during automated smoke
    [buyer, seller, admin].each { |u| u.add_two_factor_authenticated_ip!("127.0.0.1") }

    puts "============================================================"
    puts "Localization Verification: Browser Smoke Script"
    puts "============================================================"
    puts "Found seeded buyer:  #{buyer.email}"
    puts "Found seeded seller: #{seller.email}"
    puts "Found seeded admin:  #{admin.email} (is_team_member: #{admin.is_team_member?})"
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
        email: ADMIN_EMAIL,
        routes: [
          "/admin?locale=pseudo",
          "/admin/creators?locale=pseudo",
          "/admin/orders?locale=pseudo",
          "/admin/payouts?locale=pseudo"
        ]
      }
    ]

    untranslated_report = {}
    failed_routes       = {}
    route_final_urls    = {}
    all_layout_issues   = {}

    puts "------------------------------------------------------------"
    puts "Phase 1: Pseudo-Locale Scanning (?locale=pseudo)"
    puts "------------------------------------------------------------"

    persona_routes.each do |persona|
      puts "\n[Persona: #{persona[:role]}]"
      if persona[:login]
        first_path = URI.parse(persona[:routes].first).path
        login_user(persona[:email], PASSWORD, next_path: first_path)
      else
        logout_user
      end

      persona[:routes].each do |route|
        puts "\n  Requesting #{route} ..."
        visit_route(route)

        final_url   = page.current_url
        final_path  = page.current_path
        page_title  = page.title
        route_final_urls[route] = { final_url:, final_path:, page_title: }

        puts "    Final URL: #{final_url}"
        puts "    Title:     \"#{page_title}\""

        expected_path = URI.parse(route).path
        canonical_expected = KNOWN_CANONICAL_REDIRECTS[expected_path] || expected_path

        # Assert final URL path equals requested route; fail if redirected to /login
        if final_path == "/login" && expected_path != "/login"
          puts "    ✗ FAILED (redirected to /login — unauthenticated or unauthorized)"
          failed_routes[route] = "Redirected to /login (expected #{expected_path})"
          next
        elsif final_path != expected_path && final_path != canonical_expected
          puts "    ✗ FAILED (path mismatch: expected #{expected_path}, got #{final_path})"
          failed_routes[route] = "Path mismatch: expected #{expected_path}, got #{final_path}"
          next
        end

        raw = page.evaluate_script(FIND_UNTRANSLATED_JS)
        texts = raw.is_a?(Array) ? raw : []
        untranslated_report[route] = texts
        puts "    Status:    #{texts.empty? ? '✓ 0 untranslated' : "✗ #{texts.size} untranslated"}"
        texts.each { |t| puts "      • #{t}" }
      end
    end

    puts "\n------------------------------------------------------------"
    puts "Phase 2: Amharic Screenshots & Layout Checks (?locale=am)"
    puts "------------------------------------------------------------"

    screenshot_routes = [
      { role: "Public", login: false, route: "/discover?locale=am",          label: "discover_am" },
      { role: "Public", login: false, route: "/login?locale=am",             label: "login_am" },
      { role: "Buyer",  login: true,  email: BUYER_EMAIL,  route: "/library?locale=am",            label: "buyer_library_am" },
      { role: "Seller", login: true,  email: SELLER_EMAIL, route: "/dashboard?locale=am",          label: "seller_dashboard_am" },
      { role: "Seller", login: true,  email: SELLER_EMAIL, route: "/products?locale=am",           label: "seller_products_am" },
      { role: "Seller", login: true,  email: SELLER_EMAIL, route: "/settings/payments?locale=am",   label: "seller_payments_am" },
      { role: "Admin",  login: true,  email: ADMIN_EMAIL,  route: "/admin?locale=am",              label: "admin_overview_am" }
    ]

    saved_screenshots = []
    screenshot_hashes = Hash.new { |h, k| h[k] = {} } # width => { sha256 => { route:, label:, file: } }
    duplicate_errors  = []

    screenshot_routes.each do |item|
      puts "\n[#{item[:role]}] #{item[:route]}"
      if item[:login]
        target_path = URI.parse(item[:route]).path
        login_user(item[:email], PASSWORD, next_path: target_path)
      else
        logout_user
      end

      [375, 1280].each do |width|
        file, issues = screenshot_at(item[:route], item[:label], width)
        if file
          saved_screenshots << file
          puts "  📷 #{width}px -> #{file.basename}"

          # SHA-256 byte-identical collision detection across different routes
          sha = Digest::SHA256.file(file.to_s).hexdigest
          existing = screenshot_hashes[width][sha]
          if existing && existing[:route] != item[:route]
            error_msg = "Duplicate screenshot at #{width}px: #{file.basename} is byte-identical to #{existing[:file].basename} (SHA-256: #{sha[0, 12]}...)"
            duplicate_errors << error_msg
            puts "     ❌ #{error_msg}"
          else
            screenshot_hashes[width][sha] = { route: item[:route], label: item[:label], file: }
          end
        end

        if issues.any?
          all_layout_issues["#{item[:route]} @ #{width}px"] = issues
          puts "     ⚠️  #{issues.size} Amharic-specific layout issue(s) detected:"
          issues.first(5).each do |issue|
            if issue["type"] == "horizontal_overflow"
              puts "        - Horizontal overflow: #{issue['detail']}"
            else
              puts "        - Text clipped in <#{issue['tag']}>: \"#{issue['text']}\" (client: #{issue['clientWidth']}px, scroll: #{issue['scrollWidth']}px)"
            end
          end
        else
          puts "     ✓ Layout clean (no Amharic-specific clipping or overflow)"
        end
      end
    end

    puts "\n============================================================"
    puts "Final Localization Verification Summary"
    puts "============================================================"
    total_untranslated = untranslated_report.values.sum(&:size)
    puts "Total routes checked:        #{untranslated_report.size + failed_routes.size}"
    puts "Routes passed path check:    #{untranslated_report.size}"
    puts "Routes failed path/redirect: #{failed_routes.size}"
    puts "Total untranslated nodes:    #{total_untranslated}"
    puts "Total screenshots captured:  #{saved_screenshots.size}"
    puts "Total Amharic layout issues: #{all_layout_issues.values.sum(&:size)}"
    puts "Duplicate screenshot errors: #{duplicate_errors.size}"
    puts

    puts "Per-Route Results (Untranslated count & Final URL):"
    route_final_urls.each do |route, info|
      if failed_routes.key?(route)
        puts "  ✗ FAILED     #{route}"
        puts "               Final URL: #{info[:final_url]}"
        puts "               Title:     \"#{info[:page_title]}\""
        puts "               Reason:    #{failed_routes[route]}"
      else
        count = untranslated_report[route]&.size || 0
        status = count.zero? ? "✓ OK (0)" : "✗ #{count} untranslated"
        puts "  #{status.ljust(22)} #{route}"
        puts "               Final URL: #{info[:final_url]}"
        puts "               Title:     \"#{info[:page_title]}\""
      end
    end

    if all_layout_issues.any?
      puts "\nAmharic Layout Clipping / Overflow Issues (locale=am diff vs locale=en):"
      all_layout_issues.each do |context, issues|
        puts "  #{context}:"
        issues.each do |issue|
          puts "    • [#{issue['type']}] #{issue['detail'] || "#{issue['tag']}: #{issue['text']}"}"
        end
      end
    else
      puts "\n✓ No Amharic-specific layout overflow or clipping detected."
    end

    if duplicate_errors.any?
      puts "\n❌ DUPLICATE SCREENSHOT FAILURES:"
      duplicate_errors.each { |err| puts "  • #{err}" }
    end

    puts "\nScreenshots directory: #{SCREENSHOT_DIR}/"

    if failed_routes.any? || duplicate_errors.any?
      exit 1
    end
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

    def login_user(email, password, next_path: nil)
      return if @current_logged_in_user == email

      logout_user
      login_url = next_path ? "/login?next=#{CGI.escape(next_path)}" : "/login"
      visit login_url
      wait_for_page_ready

      Timeout.timeout(Capybara.default_max_wait_time) do
        sleep 0.1 until page.evaluate_script(<<~JS)
          (function() {
            var emailEl = document.querySelector('input[type="email"]');
            var passEl = document.querySelector('input[type="password"]');
            var btn = document.querySelector('button[type="submit"]');
            return emailEl && passEl && btn && !btn.disabled;
          })()
        JS
      end

      page.evaluate_script(<<~JS, email, password)
        (function(email, pass) {
          var emailEl = document.querySelector('input[type="email"]');
          var passEl = document.querySelector('input[type="password"]');
          var btn = document.querySelector('button[type="submit"]');
          if (!emailEl || !passEl || !btn) return false;

          var setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
          setter.call(emailEl, email);
          emailEl.dispatchEvent(new Event("input", { bubbles: true }));
          emailEl.dispatchEvent(new Event("change", { bubbles: true }));

          setter.call(passEl, pass);
          passEl.dispatchEvent(new Event("input", { bubbles: true }));
          passEl.dispatchEvent(new Event("change", { bubbles: true }));

          btn.click();
          return true;
        })(arguments[0], arguments[1]);
      JS

      Timeout.timeout(Capybara.default_max_wait_time) do
        sleep 0.2 until page.current_path != "/login"
      end rescue nil
      wait_for_page_ready

      if page.current_path == "/login"
        warn "  ✗ Login failed for #{email} (still on /login: url=#{page.current_url})"
        page.driver.browser.logs.get(:browser).each { |l| warn "    [browser] #{l.message}" }
      else
        @current_logged_in_user = email
        puts "  ✓ Logged in as #{email} (current path: #{page.current_path})"
      end
    rescue => e
      warn "  ✗ Login error for #{email}: #{e.message}"
      warn e.backtrace.first(5).map { |l| "      #{l}" }.join("\n")
    end

    def logout_user
      return if @current_logged_in_user.nil?

      @current_logged_in_user = nil
      visit "/logout" rescue nil
      wait_for_page_ready rescue nil
      page.driver.browser.manage.delete_all_cookies rescue nil
    rescue => e
      warn "  ✗ Logout error: #{e.message}"
    end

    def screenshot_at(route, label, width)
      page.driver.browser.manage.window.resize_to(width, 900)

      # 1. Check English baseline layout at identical viewport
      en_route = route.sub("locale=am", "locale=en")
      visit_route(en_route)
      raw_en = page.evaluate_script(CHECK_LAYOUT_JS)
      en_issues = raw_en.is_a?(Array) ? raw_en : []
      en_keys = Set.new(en_issues.map { |iss| iss["key"] })

      # 2. Check Amharic layout & capture screenshot
      visit_route(route)
      expected_path = URI.parse(route).path
      canonical_expected = KNOWN_CANONICAL_REDIRECTS[expected_path] || expected_path
      if page.current_path != expected_path && page.current_path != canonical_expected
        warn "  ✗ Path mismatch on screenshot route: expected #{expected_path}, got #{page.current_path}"
      end

      route_slug = expected_path.delete_prefix("/").tr("/", "_")
      route_slug = "root" if route_slug.empty?
      file = SCREENSHOT_DIR.join("#{label}_#{route_slug}_#{width}w.png")
      page.save_screenshot(file.to_s)

      raw_am = page.evaluate_script(CHECK_LAYOUT_JS)
      am_issues = raw_am.is_a?(Array) ? raw_am : []
      # Filter to issues that occur in locale=am but NOT in locale=en
      amharic_only_issues = am_issues.reject { |iss| en_keys.include?(iss["key"]) }

      [file, amharic_only_issues]
    rescue => e
      warn "  ✗ Screenshot failed for #{route} @ #{width}px: #{e.message}"
      warn e.backtrace.first(5).map { |l| "      #{l}" }.join("\n")
      [nil, []]
    end
end

LocaleSmokeRunner.new.run
