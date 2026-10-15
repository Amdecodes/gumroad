# frozen_string_literal: true

# Verifies Rails locale key coverage:
# 1. am.yml has all keys that en.yml has (and no extras)
# 2. i18n-tasks missing: No keys used in Ruby/ERB code are missing from en.yml or am.yml
# 3. i18n-tasks normalize: Locale files are properly normalized and formatted

require "spec_helper"
require "yaml"
require "i18n/tasks"

RSpec.describe "Rails I18n locale coverage" do
  let(:i18n) { I18n::Tasks::BaseTask.new }

  def deep_leaf_keys(hash, prefix = "")
    hash.each_with_object([]) do |(key, value), keys|
      full_key = prefix.empty? ? key.to_s : "#{prefix}.#{key}"
      if value.is_a?(Hash)
        keys.concat(deep_leaf_keys(value, full_key))
      else
        keys << full_key
      end
    end
  end

  let(:en_raw) { YAML.safe_load_file(Rails.root.join("config/locales/en.yml"), permitted_classes: [Symbol], symbolize_names: false) }
  let(:am_raw) { YAML.safe_load_file(Rails.root.join("config/locales/am.yml"), permitted_classes: [Symbol], symbolize_names: false) }
  let(:en_keys) { deep_leaf_keys(en_raw.fetch("en", {})).sort }
  let(:am_keys) { deep_leaf_keys(am_raw.fetch("am", {})).sort }

  it "am.yml has all keys present in en.yml" do
    missing = en_keys - am_keys
    expect(missing).to eq([]),
                       -> { "Keys in en.yml missing from am.yml:\n#{missing.map { |k| "  - #{k}" }.join("\n")}" }
  end

  it "am.yml has no extra keys not in en.yml" do
    extra = am_keys - en_keys
    expect(extra).to eq([]),
                     -> { "Keys in am.yml not in en.yml:\n#{extra.map { |k| "  - #{k}" }.join("\n")}" }
  end

  describe "i18n-tasks" do
    it "has no missing keys in code" do
      missing = i18n.missing_keys
      expect(missing).to be_empty,
                         -> {
                           leaves = missing.leaves.to_a
                           "Missing #{leaves.count} i18n keys in code, run `i18n-tasks missing' to inspect:\n" +
                             leaves.map { |l| "  - #{l.full_key} (used in: #{l.data[:occurrences]&.map(&:to_s)&.join(', ')})" }.join("\n")
                         }
    end

    it "has normalized translation files" do
      non_normalized = i18n.non_normalized_paths
      expect(non_normalized).to be_empty,
                                -> {
                                  "The following translation files are not normalized, run `i18n-tasks normalize' to fix:\n" +
                                    non_normalized.map { |path| "  - #{path}" }.join("\n")
                                }
    end
  end
end
