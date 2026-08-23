const mongoose = require('mongoose');

const tripSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    expenses: [
      {
        description: String,
        amount: Number,
        category: { type: String, required: true },
        // Multi-payer support with individual paid amounts
        paidBy: [{ user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, amount: Number }],
        // Equal split member IDs
        splitBetween: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
        // Optional custom/unequal split amounts
        splits: [{ user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, amount: Number }],
        splitType: { type: String, enum: ['equal', 'exact'], default: 'equal' }
      }
    ],
    // Attached Travel Plan (Exactly 1 specific version attached to trip)
    attachedPlan: {
      planId: { type: String },
      title: { type: String },
      destination: { type: String },
      version: { type: Number },
      itinerary: { type: String },
      duration: { type: String },
      groupSize: { type: String },
      budget: { type: String },
      attachedAt: { type: Date, default: Date.now }
    },
    balanceMatrix: {
      type: [[Number]],
      default: []
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Trip', tripSchema);
