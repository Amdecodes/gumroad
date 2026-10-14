# frozen_string_literal: true

class AddLocaleToPurchases < ActiveRecord::Migration[7.1]
  def change
    add_column :purchases, :locale, :string, default: "en", null: false
  end
end
