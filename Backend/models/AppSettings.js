const mongoose = require('mongoose');

const BankAccountSchema = new mongoose.Schema({
  bankName: String,
  accountName: String,
  accountNumber: String,
  iban: String,
  swift: String,
  branch: String,
  instructions: String, // ← ملاحظات البنك
}, { _id: true });

const RemittanceOfficeSchema = new mongoose.Schema({
  officeName: String,
  country: String,
  city: String,
  contact: String,
  instructions: String, // ← ملاحظات المكتب
}, { _id: true });

const AppSettingsSchema = new mongoose.Schema({
  paymentsExtra: {
    bankAccounts: [BankAccountSchema],
    remittanceOffices: [RemittanceOfficeSchema],
  },
}, { timestamps: true, collection: 'app_settings' });

AppSettingsSchema.statics.getSingleton = async function () {
  let doc = await this.findOne({});
  if (!doc) {
    doc = await this.create({
      paymentsExtra: { bankAccounts: [], remittanceOffices: [] },
    });
  }
  return doc;
};

module.exports = mongoose.model('AppSettings', AppSettingsSchema);