# frozen_string_literal: true

# Create the shared Chapa merchant account
if MerchantAccount.gumroad("chapa").nil?
  merchant_account_chapa = MerchantAccount.new
  merchant_account_chapa.charge_processor_id = "chapa"
  merchant_account_chapa.save!
end
