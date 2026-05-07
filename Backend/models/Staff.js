const mongoose = require('mongoose');

const PermissionsSchema = new mongoose.Schema(
  {
    viewStats: { type: Boolean, default: false },
    manageProviders: { type: Boolean, default: false },
    viewUsers: { type: Boolean, default: false },
    manageStaff: { type: Boolean, default: false },
    manageBlog: { type: Boolean, default: false },
    publishBlog: { type: Boolean, default: false },
    manageReviews: { type: Boolean, default: false },
    manageSupport: { type: Boolean, default: false },
  },
  { _id: false }
);

const StaffSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    passwordHash: { type: String, required: true },
    role: {
      type: String,
      enum: ['Support', 'Content', 'Ops', 'Admin'],
      default: 'Support',
      index: true,
    },
    permissions: { type: PermissionsSchema, default: () => ({}) },
    enabled: { type: Boolean, default: true },
  },
  { timestamps: true }
);

StaffSchema.methods.toPublic = function () {
  const obj = this.toObject();
  delete obj.passwordHash;
  return obj;
};

module.exports = mongoose.model('Staff', StaffSchema);