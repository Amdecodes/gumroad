# frozen_string_literal: true

require "spec_helper"
require "rake"

describe "admin.rake", type: :task do
  let(:user) { create(:user, email: "candidate@example.com", is_team_member: false) }

  before do
    Rake.application.rake_require("tasks/admin")
    Rake::Task.define_task(:environment) unless Rake::Task.task_defined?(:environment)
    Rake::Task["admin:grant"].reenable
    Rake::Task["admin:revoke"].reenable
  end

  describe "admin:grant" do
    it "grants is_team_member=true to the target user and logs the action" do
      allow(ENV).to receive(:[]).and_call_original
      allow(ENV).to receive(:[]).with("EMAIL").and_return(user.email)
      allow(ENV).to receive(:[]).with("USER").and_return("ops-engineer")

      expect(Rails.logger).to receive(:info).with(/\[ADMIN_AUDIT\].*admin_grant.*candidate@example\.com/)

      expect { Rake::Task["admin:grant"].invoke }.to output(/Granted staff access/).to_stdout
      expect(user.reload.is_team_member?).to be(true)
    end

    it "aborts if EMAIL is missing" do
      allow(ENV).to receive(:[]).and_call_original
      allow(ENV).to receive(:[]).with("EMAIL").and_return("")

      expect { Rake::Task["admin:grant"].invoke }.to raise_error(SystemExit)
    end

    it "aborts if user email does not exist" do
      allow(ENV).to receive(:[]).and_call_original
      allow(ENV).to receive(:[]).with("EMAIL").and_return("nonexistent@example.com")

      expect { Rake::Task["admin:grant"].invoke }.to raise_error(SystemExit)
    end
  end

  describe "admin:revoke" do
    before do
      user.update!(is_team_member: true)
    end

    it "revokes is_team_member from the target user and logs the action" do
      allow(ENV).to receive(:[]).and_call_original
      allow(ENV).to receive(:[]).with("EMAIL").and_return(user.email)
      allow(ENV).to receive(:[]).with("USER").and_return("security-lead")

      expect(Rails.logger).to receive(:info).with(/\[ADMIN_AUDIT\].*admin_revoke.*candidate@example\.com/)

      expect { Rake::Task["admin:revoke"].invoke }.to output(/Revoked staff access/).to_stdout
      expect(user.reload.is_team_member?).to be(false)
    end

    it "aborts if EMAIL is missing" do
      allow(ENV).to receive(:[]).and_call_original
      allow(ENV).to receive(:[]).with("EMAIL").and_return("")

      expect { Rake::Task["admin:revoke"].invoke }.to raise_error(SystemExit)
    end

    it "aborts if user email does not exist" do
      allow(ENV).to receive(:[]).and_call_original
      allow(ENV).to receive(:[]).with("EMAIL").and_return("nonexistent@example.com")

      expect { Rake::Task["admin:revoke"].invoke }.to raise_error(SystemExit)
    end
  end
end
