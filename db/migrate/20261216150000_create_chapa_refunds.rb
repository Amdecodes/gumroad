# frozen_string_literal: true

# rubocop:disable Rails/BulkChangeTable
class CreateChapaRefunds < ActiveRecord::Migration[7.1]
  def change
    create_table :chapa_refunds do |t|
      t.references :purchase, null: false, foreign_key: true
      t.references :chapa_transaction, null: true, foreign_key: true
      t.bigint :amount_santims, null: false
      t.string :refund_reference, null: false
      t.string :status, default: "initiated", null: false
      t.integer :attempts_count, default: 0, null: false
      t.string :chapa_ref_id
      t.text :error_message
      t.json :raw_payload

      t.timestamps
    end

    add_index :chapa_refunds, :refund_reference, unique: true
    add_index :chapa_refunds, :status
  end
end
# rubocop:enable Rails/BulkChangeTable
