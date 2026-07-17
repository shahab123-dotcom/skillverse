import './StripePaymentModal.css';
import React, { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { CreditCard, X, Lock, CheckCircle, ChevronLeft, DollarSign, Shield, Clock } from 'lucide-react';
import { API_URL } from '../../App';

let stripePromise = null;
const getStripe = async () => {
  if (!stripePromise) {
    const res = await fetch(`${API_URL}/api/payment/config`);
    const data = await res.json();
    if (!data.publishableKey) throw new Error('Stripe publishable key not configured');
    stripePromise = loadStripe(data.publishableKey);
  }
  return stripePromise;
};

const CARD_ELEMENT_OPTIONS = {
  style: {
    base: {
      color: '#f5f5f7',
      fontFamily: '"Outfit", sans-serif',
      fontSize: '15px',
      fontSmoothing: 'antialiased',
      '::placeholder': { color: '#5c5c66' },
      iconColor: '#ff6b00'
    },
    invalid: { color: '#ef4444', iconColor: '#ef4444' }
  }
};

// ─── Step 1: Confirm Amount ───────────────────────────────────────────────────
function AmountStep({ job, onContinue, onClose }) {
  const [amount, setAmount] = useState(String(job.payment?.amount || 0));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const numAmount = parseFloat(amount) || 0;
  const platformFee = Math.round(numAmount * 0.1);
  const workerAmount = numAmount - platformFee;

  async function handleContinue() {
    if (numAmount < 100) {
      setError('Minimum payment amount is PKR 100.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/payment/create-payment-intent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ jobId: job._id, amount: numAmount })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to initialize payment');
      onContinue({ clientSecret: data.clientSecret, confirmedAmount: numAmount });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="spm-step">
      <div className="spm-step-header">
        <div className="spm-step-icon">
          <DollarSign size={22} />
        </div>
        <div>
          <h3 className="spm-step-title">Confirm Payment Amount</h3>
          <p className="spm-step-sub">Review &amp; adjust the agreed amount before checkout</p>
        </div>
      </div>

      <div className="spm-job-pill">
        <span className="spm-job-pill__cat">{job.category}</span>
        <span className="spm-job-pill__id">Job #{String(job._id).slice(-6)}</span>
        {job.worker?.name && <span className="spm-job-pill__worker">👷 {job.worker.name}</span>}
      </div>

      <div className="spm-field-group">
        <label className="spm-label" htmlFor="spm-amount">
          Final Agreed Amount (PKR)
        </label>
        <div className="spm-amount-input-wrap">
          <span className="spm-currency">₨</span>
          <input
            id="spm-amount"
            className="spm-amount-input"
            type="number"
            min="100"
            step="50"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            placeholder="Enter amount"
          />
        </div>
        <p className="spm-hint">You can adjust the amount if you negotiated a different price with the worker.</p>
      </div>

      {numAmount > 0 && (
        <div className="spm-breakdown">
          <div className="spm-breakdown__row">
            <span>Total Charged</span>
            <strong>PKR {numAmount.toLocaleString()}</strong>
          </div>
          <div className="spm-breakdown__row spm-breakdown__fee">
            <span>Platform Fee (10%)</span>
            <span>− PKR {platformFee.toLocaleString()}</span>
          </div>
          <div className="spm-breakdown__divider" />
          <div className="spm-breakdown__row spm-breakdown__worker">
            <span>👷 Worker Receives (90%)</span>
            <strong className="spm-green">PKR {workerAmount.toLocaleString()}</strong>
          </div>
        </div>
      )}

      <div className="spm-escrow-notice">
        <Clock size={14} />
        <span>
          Payment is <strong>held in escrow for 24 hours</strong>. Funds are released automatically
          unless you file a complaint during this window.
        </span>
      </div>

      {error && <p className="spm-error">{error}</p>}

      <div className="spm-actions">
        <button type="button" className="spm-btn spm-btn--ghost" onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          className="spm-btn spm-btn--primary"
          onClick={handleContinue}
          disabled={loading || numAmount < 100}
        >
          {loading ? (
            <span className="spm-spinner" />
          ) : (
            <>
              <Lock size={14} /> Continue to Payment
            </>
          )}
        </button>
      </div>
    </div>
  );
}

// ─── Step 2: Card Details & Confirm ──────────────────────────────────────────
function CardStep({ job, clientSecret, confirmedAmount, onBack, onSuccess, onClose }) {
  const stripe = useStripe();
  const elements = useElements();
  const [status, setStatus] = useState('idle'); // idle | processing | success | error
  const [errorMsg, setErrorMsg] = useState('');
  const [cardComplete, setCardComplete] = useState(false);

  async function handlePay(e) {
    e.preventDefault();
    if (!stripe || !elements || !clientSecret) return;

    setStatus('processing');
    setErrorMsg('');

    const cardElement = elements.getElement(CardElement);
    const { error: stripeError, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
      payment_method: { card: cardElement }
    });

    if (stripeError) {
      setErrorMsg(stripeError.message);
      setStatus('error');
      return;
    }

    if (paymentIntent.status === 'succeeded') {
      try {
        const res = await fetch(`${API_URL}/api/payment/confirm-payment`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({ jobId: job._id, paymentIntentId: paymentIntent.id })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to confirm payment');
        setStatus('success');
        setTimeout(() => onSuccess(data), 1800);
      } catch (err) {
        setErrorMsg(err.message);
        setStatus('error');
      }
    }
  }

  if (status === 'success') {
    return (
      <div className="spm-success">
        <div className="spm-success__icon">
          <CheckCircle size={48} />
        </div>
        <h3>Payment Successful!</h3>
        <p>
          <strong>PKR {confirmedAmount.toLocaleString()}</strong> held in escrow.
          <br />Funds release to the worker automatically in 24 hours.
        </p>
        <p className="spm-success__hint">You can file a complaint within 24 hours if needed.</p>
      </div>
    );
  }

  return (
    <form className="spm-step" onSubmit={handlePay}>
      <div className="spm-step-header">
        <div className="spm-step-icon">
          <CreditCard size={22} />
        </div>
        <div>
          <h3 className="spm-step-title">Enter Card Details</h3>
          <p className="spm-step-sub">Secured by Stripe — your card data never touches our server</p>
        </div>
      </div>

      <div className="spm-amount-badge">
        <Shield size={14} />
        <span>Paying <strong>PKR {confirmedAmount.toLocaleString()}</strong> via Stripe Escrow</span>
      </div>

      <div className="spm-card-wrap">
        <label className="spm-label">Card Information</label>
        <div className="spm-card-element-box">
          <CardElement
            options={CARD_ELEMENT_OPTIONS}
            onChange={e => setCardComplete(e.complete)}
          />
        </div>
        <p className="spm-hint">Test card: <code>4242 4242 4242 4242</code> | Any future date | Any CVC</p>
      </div>

      {errorMsg && (
        <div className="spm-error-box">
          <span>{errorMsg}</span>
        </div>
      )}

      <div className="spm-actions">
        <button
          type="button"
          className="spm-btn spm-btn--ghost"
          onClick={onBack}
          disabled={status === 'processing'}
        >
          <ChevronLeft size={16} /> Back
        </button>
        <button
          type="submit"
          className="spm-btn spm-btn--primary"
          disabled={!stripe || !cardComplete || status === 'processing'}
        >
          {status === 'processing' ? (
            <><span className="spm-spinner" /> Processing…</>
          ) : (
            <><Lock size={14} /> Pay PKR {confirmedAmount.toLocaleString()}</>
          )}
        </button>
      </div>
    </form>
  );
}

// ─── Inner Wizard (must be inside <Elements>) ─────────────────────────────────
function PaymentWizard({ job, onSuccess, onClose }) {
  const [step, setStep] = useState(1);
  const [intentData, setIntentData] = useState(null); // { clientSecret, confirmedAmount }

  function handleAmountConfirmed(data) {
    setIntentData(data);
    setStep(2);
  }

  return step === 1 ? (
    <AmountStep job={job} onContinue={handleAmountConfirmed} onClose={onClose} />
  ) : (
    <CardStep
      job={job}
      clientSecret={intentData.clientSecret}
      confirmedAmount={intentData.confirmedAmount}
      onBack={() => setStep(1)}
      onSuccess={onSuccess}
      onClose={onClose}
    />
  );
}

// ─── Outer Modal (loads Stripe lazily) ────────────────────────────────────────
export default function StripePaymentModal({ job, onSuccess, onClose }) {
  const [stripe, setStripe] = useState(null);
  const [stripeError, setStripeError] = useState('');

  useEffect(() => {
    getStripe()
      .then(setStripe)
      .catch(err => setStripeError(err.message));
  }, []);

  return (
    <div className="spm-overlay" onClick={onClose}>
      <div
        className="spm-modal"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Job Payment"
      >
        {/* Header */}
        <div className="spm-modal-header">
          <div className="spm-modal-header__left">
            <span className="spm-modal-header__icon"><CreditCard size={18} /></span>
            <span className="spm-modal-header__title">Secure Escrow Payment</span>
          </div>
          <button className="spm-close" onClick={onClose} aria-label="Close modal">
            <X size={18} />
          </button>
        </div>

        {/* Step Progress */}
        <div className="spm-progress">
          <div className="spm-progress__step spm-progress__step--active">
            <span>1</span> Confirm Amount
          </div>
          <div className="spm-progress__bar" />
          <div className="spm-progress__step">
            <span>2</span> Card Payment
          </div>
        </div>

        {/* Body */}
        <div className="spm-body">
          {stripeError ? (
            <div className="spm-init-error">
              <p>⚠️ Failed to load payment system: {stripeError}</p>
              <button className="spm-btn spm-btn--ghost" onClick={onClose}>Close</button>
            </div>
          ) : !stripe ? (
            <div className="spm-loading">
              <span className="spm-spinner spm-spinner--lg" />
              <p>Initializing secure payment…</p>
            </div>
          ) : (
            <Elements stripe={stripe}>
              <PaymentWizard job={job} onSuccess={onSuccess} onClose={onClose} />
            </Elements>
          )}
        </div>

        {/* Footer */}
        <div className="spm-modal-footer">
          <Lock size={12} />
          <span>256-bit SSL encrypted · Powered by Stripe</span>
        </div>
      </div>

    </div>
  );
}
