# frozen_string_literal: true

namespace :admin do
  desc "Grant staff privileges (is_team_member=true) to a user by email"
  task grant: :environment do
    email = ENV["EMAIL"].to_s.strip
    if email.blank?
      abort "Error: EMAIL environment variable is required.\nUsage: bin/rails admin:grant EMAIL=user@example.com"
    end

    user = User.find_by(email: email)
    if user.nil?
      abort "Error: User with email '#{email}' not found."
    end

    actor = ENV["USER"].presence || ENV["LOGNAME"].presence || "CLI/system"
    timestamp = Time.current.iso8601

    user.update!(is_team_member: true)

    log_data = {
      event: "admin_grant",
      actor: actor,
      target_user_id: user.id,
      target_email: user.email,
      timestamp: timestamp
    }
    Rails.logger.info("[ADMIN_AUDIT] #{log_data.to_json}")
    puts "[ADMIN_AUDIT] Granted staff access (is_team_member=true) to #{user.email} (id: #{user.id}) by #{actor} at #{timestamp}"
  end

  desc "Revoke staff privileges (is_team_member=false) from a user by email"
  task revoke: :environment do
    email = ENV["EMAIL"].to_s.strip
    if email.blank?
      abort "Error: EMAIL environment variable is required.\nUsage: bin/rails admin:revoke EMAIL=user@example.com"
    end

    user = User.find_by(email: email)
    if user.nil?
      abort "Error: User with email '#{email}' not found."
    end

    actor = ENV["USER"].presence || ENV["LOGNAME"].presence || "CLI/system"
    timestamp = Time.current.iso8601

    user.update!(is_team_member: false)

    log_data = {
      event: "admin_revoke",
      actor: actor,
      target_user_id: user.id,
      target_email: user.email,
      timestamp: timestamp
    }
    Rails.logger.info("[ADMIN_AUDIT] #{log_data.to_json}")
    puts "[ADMIN_AUDIT] Revoked staff access (is_team_member=false) from #{user.email} (id: #{user.id}) by #{actor} at #{timestamp}"
  end
end
