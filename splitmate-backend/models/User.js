// models/User.js
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    clerkId: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    username: { type: String, required: false },
    name: { type: String, required: false }
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);
