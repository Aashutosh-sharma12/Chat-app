const mongoose = require('mongoose');

const { ObjectId } = mongoose.Schema.Types;

const callLogSchema = new mongoose.Schema(
  {
    callId: { type: String, required: true, unique: true },
    caller: { type: ObjectId, ref: 'User', required: true, index: true },
    callee: { type: ObjectId, ref: 'User', required: true, index: true },
    callType: { type: String, enum: ['audio', 'video'], required: true },
    status: {
      type: String,
      enum: ['ringing', 'answered', 'missed', 'rejected', 'busy', 'ended'],
      default: 'ringing',
    },
    answeredAt: Date,
    endedAt: Date,
    duration: { type: Number, default: 0 }, // seconds
  },
  { timestamps: true }
);

module.exports = mongoose.model('CallLog', callLogSchema);
