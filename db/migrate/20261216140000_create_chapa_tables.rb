# frozen_string_literal: true

class CreateChapaTables < ActiveRecord::Migration[7.1]
  def change
    create_table :chapa_transactions do |t|
      t.string :tx_ref, null: false
      t.references :order, null: false, foreign_key: true
      t.references :purchase, null: true, foreign_key: true
      t.bigint :amount_santims, null: false
      t.decimal :amount_decimal, precision: 12, scale: 2, null: false
      t.string :currency, default: "ETB", null: false
      t.string :status, default: "pending", null: false
      t.string :chapa_reference
      t.string :mode # "test" or "live"
      t.bigint :charge_cents, default: 0
      t.decimal :charge_decimal, precision: 10, scale: 2
      t.string :payment_method
      t.json :raw_payload
      t.text :error_message
      t.datetime :verified_at
      t.datetime :expires_at

      t.timestamps
    end

    add_index :chapa_transactions, :tx_ref, unique: true
    add_index :chapa_transactions, :status
    add_index :chapa_transactions, :chapa_reference

    create_table :chapa_webhook_events do |t|
      t.string :idempotency_key, null: false
      t.string :event_type, null: false
      t.string :tx_ref
      t.text :raw_payload, null: false
      t.string :status, default: "received", null: false
      t.datetime :processed_at
      t.text :error_message

      t.timestamps
    end

    add_index :chapa_webhook_events, :idempotency_key, unique: true
    add_index :chapa_webhook_events, :tx_ref
    add_index :chapa_webhook_events, :status
  end
end
