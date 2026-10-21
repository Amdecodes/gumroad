# frozen_string_literal: true

def seed_log(msg)
  puts msg unless Rails.env.test?
end unless respond_to?(:seed_log)

seller = User.find_by(email: "seller@gumroad.com")
if seller.blank?
  seller = User.new
  seller.email = "seller@gumroad.com"
  seller.name = "Seller"
  seller.username = "seller"
  seller.confirmed_at = Time.current
  seller.user_risk_state = "compliant"
  seller.password = SecureRandom.hex(24)

  # Make seller eligible for service products
  seller.created_at = 2.months.ago
  seller.payments.build(
    state: "completed",
    amount_cents: 1000,
    processor: "paypal",
    processor_fee_cents: 100,
    payout_period_end_date: 1.day.ago
  )

  seller.save!

  # Skip validations to set a pwned but easy password
  seller.password = "password"
  seller.save!(validate: false)
end

TeamMembership::ROLES.excluding(TeamMembership::ROLE_OWNER).each do |role|
  email = "seller+#{role}@gumroad.com"
  user = User.find_by(email:)
  next if user.present?

  user = User.create!(
    email:,
    name: "#{role.humanize}ForSeller",
    username: "#{role}forseller",
    confirmed_at: Time.current,
    user_risk_state: "compliant",
    password: SecureRandom.hex(24)
  )

  # Skip validations to set a pwned but easy password
  user.password = "password"
  user.save!(validate: false)

  user.create_owner_membership_if_needed!
  user.user_memberships.create!(user:, seller:, role:)
end

dev_staff = User.find_by(email: "admin@arifdrop.test")
if dev_staff.blank?
  password_from_env = ENV["ADMIN_PASSWORD"].presence || ENV["ADMIN_DEV_PASSWORD"].presence
  generated = password_from_env.blank?
  staff_password = password_from_env || SecureRandom.hex(16)

  dev_staff = User.new(
    email: "admin@arifdrop.test",
    name: "ArifDrop Dev Staff",
    username: "admindev",
    confirmed_at: Time.current,
    is_team_member: true,
    two_factor_authentication_enabled: true,
    user_risk_state: "compliant",
    password: staff_password
  )
  dev_staff.save!

  if generated
    seed_log "================================================================================"
    seed_log "Created dev staff user: admin@arifdrop.test (is_team_member: true)"
    seed_log "Generated staff password (printed once): #{staff_password}"
    seed_log "================================================================================"
  else
    seed_log "Created dev staff user: admin@arifdrop.test with password configured from ENV."
  end
end
