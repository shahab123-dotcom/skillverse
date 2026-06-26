const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const jwt = require('jsonwebtoken');
const { Job } = require('./models');
const { computePaymentBreakdown } = require('./escrow');

const JWT_SECRET = process.env.JWT_SECRET || 'skillsverse_super_secret_session_token_key_12399';

// Middleware to authenticate JWT token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  console.log('Auth middleware - Token:', token ? 'Present' : 'Missing');
  if (!token) {
    console.error('No token provided');
    return res.status(401).json({ error: 'Access token required' });
  }
  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      console.error('Token verification failed:', err.message);
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    console.log('Token verified for user:', decoded.id);
    req.user = decoded;
    next();
  });
};

// Return Stripe publishable key to frontend
router.get('/config', (req, res) => {
  res.json({ publishableKey: process.env.STRIPE_PUBLISHABLE_KEY });
});

// Diagnostic endpoint - test authentication
router.get('/test-auth', authenticateToken, (req, res) => {
  console.log('Auth test - User:', req.user);
  res.json({ 
    message: 'Authentication successful',
    userId: req.user.id,
    userEmail: req.user.email,
    timestamp: new Date().toISOString()
  });
});

// Create PaymentIntent for a job
// Stripe requires amounts in smallest currency unit (paisa for PKR = PKR * 100)
router.post('/create-payment-intent', authenticateToken, async (req, res) => {
  try {
    const { jobId } = req.body;
    console.log(`\n=== CREATE PAYMENT INTENT ===`);
    console.log(`User ID: ${req.user.id}`);
    console.log(`Job ID: ${jobId}`);

    if (!jobId) {
      console.error('Job ID is missing');
      return res.status(400).json({ error: 'Job ID is required' });
    }

    const job = await Job.findById(jobId);
    if (!job) {
      console.error(`Job not found: ${jobId}`);
      return res.status(404).json({ error: 'Job not found' });
    }

    console.log(`Job found: ${job._id}, Customer: ${job.customer}`);

    if (String(job.customer) !== String(req.user.id)) {
      console.error(`Unauthorized: User ${req.user.id} is not the customer ${job.customer}`);
      return res.status(403).json({ error: 'Unauthorized: You are not the customer of this job' });
    }

    if (job.payment.status === 'paid') {
      console.warn(`Job already paid: ${jobId}`);
      return res.status(400).json({ error: 'This job has already been paid' });
    }

    // Convert PKR amount to paisa (smallest unit) for Stripe
    const amountInPaisa = Math.round(job.payment.amount * 100);

    console.log(`Creating payment intent - Job: ${jobId}, Amount: ${job.payment.amount} PKR (${amountInPaisa} cents USD)`);

    // Stripe does not natively support PKR — use USD for test mode
    // In production, you would use a supported currency or a local payment aggregator
    // For test mode we use USD cents ($1 = 100 cents), keeping amount same numerically
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInPaisa, // treated as cents in USD for test mode
      currency: 'usd',
      metadata: {
        jobId: jobId.toString(),
        customerId: req.user.id,
        category: job.category,
        type: job.type
      },
      description: `Skillsverse Payment: ${job.category} (${job.type}) — Job #${job._id}`
    });

    console.log(`Payment intent created: ${paymentIntent.id}`);

    res.json({
      clientSecret: paymentIntent.client_secret,
      amount: job.payment.amount,
      currency: 'PKR (test via USD)',
      jobId: job._id
    });
  } catch (error) {
    console.error('Payment Intent Error:', error.message);
    console.error('Error Stack:', error.stack);
    res.status(500).json({ error: error.message || 'Payment initialization failed' });
  }
});

// Confirm payment and update job status in DB
router.post('/confirm-payment', authenticateToken, async (req, res) => {
  try {
    const { jobId, paymentIntentId } = req.body;

    if (!jobId || !paymentIntentId) {
      console.warn('Missing required fields:', { jobId, paymentIntentId });
      return res.status(400).json({ error: 'jobId and paymentIntentId are required' });
    }

    console.log(`Processing payment for job: ${jobId}, paymentIntent: ${paymentIntentId}`);

    // Verify the payment intent was actually successful via Stripe API
    let paymentIntent;
    try {
      paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    } catch (stripeErr) {
      console.error('Stripe API error:', stripeErr.message);
      return res.status(400).json({ error: `Stripe verification failed: ${stripeErr.message}` });
    }

    if (paymentIntent.status !== 'succeeded') {
      console.warn(`Payment not succeeded. Status: ${paymentIntent.status}`);
      return res.status(400).json({ error: `Payment not completed. Status: ${paymentIntent.status}` });
    }

    // Get the job to calculate worker earnings
    const job = await Job.findById(jobId);
    if (!job) {
      console.error(`Job not found: ${jobId}`);
      return res.status(404).json({ error: 'Job not found' });
    }

    // Calculate platform fee (10%) and worker amount (90%)
    const breakdown = computePaymentBreakdown(job.payment.amount);

    console.log(`Updating job payment - Amount: ${job.payment.amount}, Worker: ${breakdown.workerAmount}, Platform: ${breakdown.platformFee}, Release: ${breakdown.releaseAt}`);

    // Update job payment status in DB with worker earnings calculation
    const updatedJob = await Job.findByIdAndUpdate(
      jobId,
      { 
        'payment.status': 'paid',
        'payment.paidAt': breakdown.paidAt,
        'payment.releaseAt': breakdown.releaseAt,
        'payment.method': 'stripe',
        'payment.platformFee': breakdown.platformFee,
        'payment.workerAmount': breakdown.workerAmount,
        'payment.holdStatus': 'held',
        'payment.stripePaymentIntentId': paymentIntentId,
        status: 'completed'
      },
      { new: true }
    );

    console.log(`Payment confirmed successfully for job: ${jobId}`);

    res.json({
      message: `Payment confirmed. Funds held ${breakdown.holdLabel}. Worker receives 90% (PKR ${breakdown.workerAmount}) after hold.`,
      job: updatedJob,
      breakdown: {
        platformFee: breakdown.platformFee,
        workerAmount: breakdown.workerAmount,
        releaseAt: breakdown.releaseAt,
        holdDays: breakdown.holdDays
      }
    });
  } catch (error) {
    console.error('Confirm Payment Error:', error);
    res.status(500).json({ error: error.message || 'Payment confirmation failed' });
  }
});

module.exports = router;
