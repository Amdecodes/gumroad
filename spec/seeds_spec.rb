# frozen_string_literal: true

require "spec_helper"

describe "Database Seeds Security", type: :model do
  describe "Production guard in db/seeds.rb" do
    it "refuses to run when Rails.env is production" do
      allow(Rails).to receive(:env).and_return("production".inquiry)
      expect do
        load Rails.root.join("db/seeds.rb")
      end.to raise_error(RuntimeError, /Refusing to run seeds in production/)
    end
  end

  describe "Dev staff user seed (01_users.rb)" do
    before do
      User.where(email: ["seller@gumroad.com", "admin@arifdrop.test"]).destroy_all
    end

    it "seeds seller without staff privileges" do
      load Rails.root.join("db/seeds/020_development_staging/01_users.rb")
      seller = User.find_by(email: "seller@gumroad.com")
      expect(seller).to be_present
      expect(seller.is_team_member?).to be(false)
    end

    it "creates admin@arifdrop.test with random password and staff privilege" do
      allow(ENV).to receive(:[]).and_call_original
      allow(ENV).to receive(:[]).with("ADMIN_PASSWORD").and_return(nil)
      allow(ENV).to receive(:[]).with("ADMIN_DEV_PASSWORD").and_return(nil)

      load Rails.root.join("db/seeds/020_development_staging/01_users.rb")
      staff = User.find_by(email: "admin@arifdrop.test")
      expect(staff).to be_present
      expect(staff.is_team_member?).to be(true)
      expect(staff.two_factor_authentication_enabled?).to be(true)
      expect(staff.valid_password?("password")).to be(false)
    end

    it "creates admin@arifdrop.test with password from ENV if provided" do
      allow(ENV).to receive(:[]).and_call_original
      allow(ENV).to receive(:[]).with("ADMIN_PASSWORD").and_return("CustomEnvSecret123!")

      load Rails.root.join("db/seeds/020_development_staging/01_users.rb")
      staff = User.find_by(email: "admin@arifdrop.test")
      expect(staff).to be_present
      expect(staff.valid_password?("CustomEnvSecret123!")).to be(true)
    end
  end
end
