require('dotenv').config();
const stripe = process.env.STRIPE_SECRET_KEY
  ? require('stripe')(process.env.STRIPE_SECRET_KEY)
  : null;
const { Job, Worker } = require('./models');

const PLATFORM_FEE_RATE = 0.1;
const HOLD_MS = process.env.ESCROW_HOLD_MINUTES
  ? Number(process.env.ESCROW_HOLD_MINUTES) * 60 * 1000
  : (Number(process.env.ESCROW_HOLD_DAYS) || 1) * 24 * 60 * 60 * 1000;
const HOLD_DAYS = process.env.ESCROW_HOLD_MINUTES
  ? Number(process.env.ESCROW_HOLD_MINUTES) / (60 * 24)
  : Number(process.env.ESCROW_HOLD_DAYS) || 1;

function computePaymentBreakdown(amount) {
  const total = Number(amount) || 0;
  const platformFee = Math.round(total * PLATFORM_FEE_RATE);
  const workerAmount = total - platformFee;
  const paidAt = new Date();
  const releaseAt = new Date(paidAt.getTime() + HOLD_MS);
  const holdLabel = process.env.ESCROW_HOLD_MINUTES
    ? `${process.env.ESCROW_HOLD_MINUTES} minute(s)`
    : `${Number(process.env.ESCROW_HOLD_DAYS) || 1} day(s)`;
  return { platformFee, workerAmount, paidAt, releaseAt, holdDays: HOLD_DAYS, holdLabel };
}

function getTransferDestination(worker) {
  if (worker?.stripeAccountId) return worker.stripeAccountId;
  return process.env.STRIPE_CONNECT_DESTINATION_ACCOUNT || null;
}

async function createStripeTransfer(job, worker) {
  const destination = getTransferDestination(worker);
  if (!stripe || !destination) {
    return null;
  }

  if (job.payment.stripeTransferId) {
    return { id: job.payment.stripeTransferId, skipped: true };
  }

  const workerAmount = job.payment.workerAmount || 0;
  if (workerAmount <= 0) {
    throw new Error('Worker amount must be greater than zero to transfer');
  }

  const amountCents = Math.round(workerAmount * 100);
  const transfer = await stripe.transfers.create({
    amount: amountCents,
    currency: 'usd',
    destination,
    transfer_group: job.payment.stripePaymentIntentId || String(job._id),
    metadata: {
      jobId: String(job._id),
      workerAmount: String(workerAmount),
      platformFee: String(job.payment.platformFee || 0)
    },
    description: `Skillsverse worker payout (90%) — Job ${String(job._id).slice(-8)}`
  });

  return transfer;
}

async function releaseJobPayment(jobDoc, { force = false } = {}) {
  const job = jobDoc.worker ? jobDoc : await Job.findById(jobDoc._id || jobDoc).populate('worker');
  if (!job) throw new Error('Job not found');

  if (job.payment.status !== 'paid') {
    throw new Error('Job is not paid');
  }
  if (!['held', 'under_review'].includes(job.payment.holdStatus)) {
    return { job, skipped: true, reason: `Already ${job.payment.holdStatus}` };
  }
  if (!force && job.payment.releaseAt && job.payment.releaseAt > new Date()) {
    return { job, skipped: true, reason: 'Hold period not elapsed' };
  }

  let worker = job.worker;
  if (worker && !worker.stripeAccountId && typeof worker === 'object' && worker._id) {
    worker = await Worker.findById(worker._id);
  } else if (worker && typeof worker === 'string') {
    worker = await Worker.findById(worker);
  }

  let transfer = null;
  try {
    transfer = await createStripeTransfer(job, worker);
  } catch (err) {
    if (getTransferDestination(worker)) {
      throw new Error(`Stripe transfer failed: ${err.message}`);
    }
    console.warn(`[Escrow] DB-only release for job ${job._id} (no Stripe Connect destination):`, err.message);
  }

  job.payment.holdStatus = 'released';
  job.payment.releasedAt = new Date();
  if (transfer?.id) {
    job.payment.stripeTransferId = transfer.id;
  }
  await job.save();

  console.log(
    `[Escrow] Released job ${job._id}: worker PKR ${job.payment.workerAmount}, platform fee PKR ${job.payment.platformFee}` +
    (transfer?.id ? `, Stripe transfer ${transfer.id}` : ' (DB only)')
  );

  return { job, transfer, skipped: false };
}

async function releaseDuePayments() {
  const now = new Date();
  const dueJobs = await Job.find({
    'payment.status': 'paid',
    'payment.holdStatus': 'held',
    'payment.releaseAt': { $lte: now }
  }).populate('worker');

  let released = 0;
  let failed = 0;

  for (const job of dueJobs) {
    try {
      const result = await releaseJobPayment(job, { force: true });
      if (!result.skipped) released += 1;
    } catch (err) {
      failed += 1;
      console.error(`[Escrow] Auto-release failed for job ${job._id}:`, err.message);
    }
  }

  if (released > 0 || failed > 0) {
    console.log(`[Escrow] Scheduled run: ${released} released, ${failed} failed, ${dueJobs.length} due`);
  }

  return { released, failed, due: dueJobs.length };
}

module.exports = {
  HOLD_DAYS,
  computePaymentBreakdown,
  releaseDuePayments,
  releaseJobPayment
};
