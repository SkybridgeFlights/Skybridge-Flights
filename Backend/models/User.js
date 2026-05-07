const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    password: {
      type: String,
      required: true,
      select: false,
    },

    isVerified: {
      type: Boolean,
      default: false,
    },

    isAdmin: {
      type: Boolean,
      default: false,
    },

    verificationToken: {
      type: String,
      default: '',
    },

    verificationTokenExpires: {
      type: Date,
      default: null,
    },

    resetPasswordToken: {
      type: String,
      default: '',
    },

    resetPasswordExpires: {
      type: Date,
      default: null,
    },

    preferredAirport: {
      type: String,
      default: '',
      trim: true,
    },

    preferredCabinClass: {
      type: String,
      default: 'Economy',
      enum: ['Economy', 'Premium Economy', 'Business', 'First'],
    },

    newsletter: {
      type: Boolean,
      default: false,
    },

    permissions: {
      type: Object,
      default: {},
    },

    role: {
      type: String,
      default: 'user',
      trim: true,
    },
  },
  { timestamps: true }
);

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.comparePassword = async function (enteredPassword) {
  return bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);