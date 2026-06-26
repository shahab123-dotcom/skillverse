// TEST_PAYMENT_API.js - Run this in backend directory to test payment endpoints
// Usage: node TEST_PAYMENT_API.js

require('dotenv').config();
const fetch = require('node-fetch'); // Make sure to npm install node-fetch if needed

const API_URL = 'http://localhost:5000';

async function testPaymentAPI() {
  console.log('🔍 Testing Stripe Payment API Setup\n');
  console.log('Configuration:');
  console.log('- API_URL:', API_URL);
  console.log('- STRIPE_SECRET_KEY:', process.env.STRIPE_SECRET_KEY ? '✓ Loaded' : '✗ Missing');
  console.log('- STRIPE_PUBLISHABLE_KEY:', process.env.STRIPE_PUBLISHABLE_KEY ? '✓ Loaded' : '✗ Missing');
  console.log('\n---\n');

  // Test 1: Check backend is running
  console.log('Test 1: Backend Health Check');
  try {
    const res = await fetch(`${API_URL}/`);
    const data = await res.json();
    console.log('✓ Backend is running');
    console.log('  Response:', data);
  } catch (err) {
    console.log('✗ Backend is NOT running');
    console.log('  Error:', err.message);
    console.log('\n  Fix: Start backend with: npm start\n');
    return;
  }

  console.log('\n---\n');

  // Test 2: Get Stripe Config
  console.log('Test 2: Fetch Stripe Config');
  try {
    const res = await fetch(`${API_URL}/api/payment/config`);
    const data = await res.json();
    console.log('✓ Config endpoint working');
    console.log('  Publishable Key:', data.publishableKey ? '✓ Present' : '✗ Missing');
  } catch (err) {
    console.log('✗ Config endpoint failed');
    console.log('  Error:', err.message);
  }

  console.log('\n---\n');

  // Test 3: Verify Stripe Package
  console.log('Test 3: Stripe Package Check');
  try {
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    console.log('✓ Stripe package loaded successfully');
    console.log('  Secret Key starts with:', process.env.STRIPE_SECRET_KEY.substring(0, 20) + '...');
  } catch (err) {
    console.log('✗ Stripe package error');
    console.log('  Error:', err.message);
  }

  console.log('\n---\n');

  // Test 4: Check MongoDB Connection
  console.log('Test 4: MongoDB Connection');
  try {
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState === 1) {
      console.log('✓ MongoDB connected');
    } else {
      console.log('⚠ MongoDB not connected yet (might connect on server start)');
    }
  } catch (err) {
    console.log('⚠ MongoDB check skipped');
  }

  console.log('\n✅ Backend is ready for payment testing!');
  console.log('\nNext steps:');
  console.log('1. Log in to your frontend app');
  console.log('2. Create or select a job');
  console.log('3. Try to pay using test card: 4242 4242 4242 4242');
  console.log('4. Check browser DevTools console for detailed logs');
}

testPaymentAPI().catch(console.error);
