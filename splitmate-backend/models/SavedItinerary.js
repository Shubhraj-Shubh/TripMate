const mongoose = require('mongoose');

const savedItinerarySchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true },
    destination: { type: String },
    duration: { type: String },
    groupSize: { type: String },
    budget: { type: String },
    version: { type: Number, default: 1 },
    status: { type: String, enum: ['draft', 'revised', 'finalized'], default: 'finalized' },
    revisionFeedback: { type: String, default: '' },
    weatherResults: { type: mongoose.Schema.Types.Mixed },
    hotelResults: { type: mongoose.Schema.Types.Mixed },
    flightResults: { type: mongoose.Schema.Types.Mixed },
    budgetResults: { type: mongoose.Schema.Types.Mixed },
    itinerary: { type: String },
    selectedAgents: [{ type: String }],
    tripConstraints: { type: mongoose.Schema.Types.Mixed }
  },
  { timestamps: true }
);

module.exports = mongoose.model('SavedItinerary', savedItinerarySchema);
