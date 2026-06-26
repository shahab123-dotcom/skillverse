const mongoose = require('mongoose');
const { Schema } = mongoose;

// User Schema (Customers & Admin)
const UserSchema = new Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  phone: { type: String, required: true },
  role: { type: String, enum: ['customer', 'admin'], default: 'customer' },
  isBlocked: { type: Boolean, default: false }
});

// Worker Schema
const WorkerSchema = new Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  phone: { type: String, required: true },
  skills: [{ type: String }], // e.g. Plumbing, Electrical, Cleaning, Structural, Woodwork, etc.
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  isAvailable: { type: Boolean, default: false },
  latitude: { type: Number, default: 24.8607 },  // Default coordinates (e.g. Karachi-like center)
  longitude: { type: Number, default: 67.0011 },
  totalRequests: { type: Number, default: 0 },
  completedRequests: { type: Number, default: 0 },
  isBlocked: { type: Boolean, default: false },
  stripeAccountId: { type: String, default: '' } // Stripe Connect account for payouts
});

// Job Schema (Handles both Daily Routine and Newly Construction)
const JobSchema = new Schema({
  type: { type: String, enum: ['daily', 'construction'], required: true },
  category: { type: String, required: true },
  customer: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  worker: { type: Schema.Types.ObjectId, ref: 'Worker', default: null },
  description: { type: String, default: '' },
  voiceUrl: { type: String, default: '' }, // File path to audio note
  voiceTranscript: { type: String, default: '' }, // Optional text transcript
  location: {
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    address: { type: String, required: true }
  },
  status: { 
    type: String, 
    enum: ['pending', 'assigned', 'en_route', 'completed', 'cancelled'], 
    default: 'pending' 
  },
  payment: {
    amount: { type: Number, default: 0 },
    status: { type: String, enum: ['pending', 'paid'], default: 'pending' },
    method: { type: String, default: '' }, // 'stripe'
    holdStatus: { 
      type: String, 
      enum: ['held', 'released', 'refunded', 'under_review'], 
      default: 'held' 
    },
    paidAt: { type: Date, default: null },
    releaseAt: { type: Date, default: null },
    releasedAt: { type: Date, default: null },
    platformFee: { type: Number, default: 0 },   // 10% of amount
    workerAmount: { type: Number, default: 0 },   // 90% of amount
    refundAmount: { type: Number, default: 0 },   // set on approved complaint
    stripePaymentIntentId: { type: String, default: '' },
    stripeTransferId: { type: String, default: '' }
  },
  createdAt: { type: Date, default: Date.now }
});

// Chat Message Schema
const MessageSchema = new Schema({
  jobId: { type: Schema.Types.ObjectId, ref: 'Job', required: true },
  sender: { type: String, enum: ['customer', 'worker'], required: true },
  text: { type: String, default: '' },
  voiceUrl: { type: String, default: '' },
  voiceDuration: { type: Number, default: 0 },
  timestamp: { type: Date, default: Date.now }
});

// Complaint / Dispute Schema
const ComplaintSchema = new Schema({
  jobId: { type: Schema.Types.ObjectId, ref: 'Job', required: true },
  customer: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  worker: { type: Schema.Types.ObjectId, ref: 'Worker', required: true },
  customerName: { type: String, default: '' },
  workerName: { type: String, default: '' },
  category: { type: String, default: '' },
  title: { type: String, required: true },
  details: { type: String, required: true },
  evidenceUrl: { type: String, default: '' },
  status: { 
    type: String, 
    enum: ['pending', 'approved', 'rejected'], 
    default: 'pending' 
  },
  refundAmount: { type: Number, default: 0 },
  adminNote: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', UserSchema);
const Worker = mongoose.model('Worker', WorkerSchema);
const Job = mongoose.model('Job', JobSchema);
const Message = mongoose.model('Message', MessageSchema);
const Complaint = mongoose.model('Complaint', ComplaintSchema);

module.exports = { User, Worker, Job, Message, Complaint };
