# frozen_string_literal: true

require "spec_helper"
require "yaml"

RSpec.describe "Localization Parity" do
  def deep_keys(hash, prefix = "")
    keys = []
    hash.each do |k, v|
      full_key = prefix.empty? ? k.to_s : "#{prefix}.#{k}"
      if v.is_a?(Hash)
        keys.concat(deep_keys(v, full_key))
      else
        keys << full_key
      end
    end
    keys.sort
  end

  it "maintains strict key parity between config/locales/en.yml and config/locales/am.yml" do
    en_yaml = YAML.load_file(Rails.root.join("config/locales/en.yml"))
    am_yaml = YAML.load_file(Rails.root.join("config/locales/am.yml"))

    expect(en_yaml["en"]).to be_present
    expect(am_yaml["am"]).to be_present

    en_keys = deep_keys(en_yaml["en"])
    am_keys = deep_keys(am_yaml["am"])

    missing_in_am = en_keys - am_keys
    extra_in_am = am_keys - en_keys

    expect(missing_in_am).to be_empty, "Keys present in en.yml but missing in am.yml: #{missing_in_am}"
    expect(extra_in_am).to be_empty, "Keys present in am.yml but missing in en.yml: #{extra_in_am}"
    expect(am_keys).to eq(en_keys)
  end
end
