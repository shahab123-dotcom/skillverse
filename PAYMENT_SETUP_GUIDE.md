# Stripe Payment Setup & Troubleshooting Guide

## ✅ Configuration Status
- **Stripe Secret Key**: Configured in `.env`
- **Stripe Publishable Key**: Configured in `.env`
- **Frontend API_URL**: `http://localhost:5000`
- **Payment Routes**: Implemented in backend

## 🚀 Quick Start

### 1. Start Backend Server
```powershell
cd "d:\haseeb files\Sahab Project\backend"
npm install
npm start
```
Expected output: `Skillsverse Backend Server running on port 5000`

### 2. Start Frontend Dev Server
```powershell
cd "d:\haseeb files\Sahab Project\frontend"
npm install
npm run dev
```

## 🧪 Testing Payment Flow

### Test Card Numbers (Stripe Test Mode)
- **Success**: `4242 4242 4242 4242`
- **Decline**: `4000 0000 0000 0002`
- **Expiry**: Any future date (e.g., 12/25)
- **CVC**: Any 3 digits (e.g., 123)

## ❌ Troubleshooting "Unexpected end of JSON input" Error

This error means the backend is not responding with valid JSON. Check these in order:

### 1. **Backend Server Running?**
- Open browser: `http://localhost:5000`
- Should see: `{"message": "Skillsverse API is running smoothly."}`
- If not, **start the backend server** (see above)

### 2. **Check Browser Console**
- Open DevTools: Press `F12`
- Go to **Console** tab
- Look for logs like:
  - `Creating payment intent with API_URL: http://localhost:5000`
  - `Payment intent response status: 200`
  - Any error messages

### 3. **Check Backend Console**
- Look for errors in the backend terminal
- Should see logs like:
  - `Creating payment intent - Job: ...`
  - `Payment intent created: pi_...`

### 4. **Verify Authentication**
- Make sure you're logged in before testing payment
- JWT token should be in `localStorage`
- Token should be included in request header: `Authorization: Bearer <token>`

### 5. **Check Network Tab**
- DevTools → **Network** tab
- Click on `/api/payment/create-payment-intent` request
- Check **Response** section for exact error from backend
- Check **Headers** → verify `Authorization` header is present

## 🔧 Common Issues

### Issue: "Failed to fetch"
**Solution**: Backend server not running or wrong port
```powershell
# Kill any process on port 5000
netstat -ano | findstr :5000
taskkill /PID <PID> /F

# Then restart backend
npm start
```

### Issue: "Invalid or expired token"
**Solution**: Log out and log back in
- Clear localStorage: `localStorage.clear()` in console
- Refresh page and log in again

### Issue: CORS Error
**Solution**: Check backend CORS configuration in `server.js`
Should have: `app.use(cors());`

### Issue: "Stripe publishable key not configured"
**Solution**: Backend not returning publishable key
- Verify `.env` has `STRIPE_PUBLISHABLE_KEY`
- Restart backend server

## 📊 Expected Flow

1. User clicks "Pay" button
2. Frontend calls: `/api/payment/create-payment-intent`
3. Backend creates Stripe PaymentIntent, returns `clientSecret`
4. User enters card details
5. Frontend calls: `stripe.confirmCardPayment(clientSecret, {card})`
6. Stripe processes payment
7. Frontend calls: `/api/payment/confirm-payment`
8. Backend verifies payment and updates job status
9. Success message displayed

## 💰 Payment Details
- Amount: Converted from PKR to USD cents
- Currency: USD (for testing)
- Platform Fee: 10%
- Worker Amount: 90%
- Funds Status: Held in escrow until admin releases
