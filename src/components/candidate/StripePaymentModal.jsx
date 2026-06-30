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

      <style>{`
        .spm-overlay {
          position: fixed; inset: 0; z-index: 9999;
          background: rgba(0,0,0,0.7);
          backdrop-filter: blur(6px);
          display: flex; align-items: center; justify-content: center;
          padding: 16px;
          animation: spm-fade-in 0.2s ease;
        }
        @keyframes spm-fade-in { from { opacity: 0 } to { opacity: 1 } }
        .spm-modal {
          background: #18181b;
          border: 1px solid rgba(255,107,0,0.18);
          border-radius: 20px;
          width: 100%; max-width: 480px;
          box-shadow: 0 32px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,107,0,0.08);
          animation: spm-slide-up 0.28s ease;
          overflow: hidden;
        }
        @keyframes spm-slide-up { from { transform: translateY(24px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }
        .spm-modal-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 18px 22px;
          border-bottom: 1px solid rgba(255,255,255,0.06);
          background: rgba(255,107,0,0.04);
        }
        .spm-modal-header__left { display: flex; align-items: center; gap: 10px; }
        .spm-modal-header__icon {
          width: 32px; height: 32px; border-radius: 8px;
          background: linear-gradient(135deg,#ff6b00,#ff9240);
          display: flex; align-items: center; justify-content: center;
          color: #fff;
        }
        .spm-modal-header__title { font-size: 15px; font-weight: 600; color: #f5f5f7; }
        .spm-close {
          background: rgba(255,255,255,0.06); border: none; border-radius: 8px;
          width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;
          color: #8a8a9a; cursor: pointer; transition: all 0.2s;
        }
        .spm-close:hover { background: rgba(239,68,68,0.15); color: #ef4444; }
        .spm-progress {
          display: flex; align-items: center; gap: 0;
          padding: 14px 22px;
          border-bottom: 1px solid rgba(255,255,255,0.05);
          background: rgba(255,255,255,0.02);
        }
        .spm-progress__step {
          display: flex; align-items: center; gap: 7px;
          font-size: 12px; color: #5c5c66; font-weight: 500;
        }
        .spm-progress__step span {
          width: 20px; height: 20px; border-radius: 50%;
          background: rgba(255,255,255,0.08);
          display: flex; align-items: center; justify-content: center;
          font-size: 11px; font-weight: 700;
        }
        .spm-progress__step--active { color: #ff6b00; }
        .spm-progress__step--active span { background: linear-gradient(135deg,#ff6b00,#ff9240); color: #fff; }
        .spm-progress__bar { flex: 1; height: 2px; background: rgba(255,255,255,0.08); margin: 0 10px; }
        .spm-body { padding: 22px; }
        .spm-step {}
        .spm-step-header { display: flex; align-items: flex-start; gap: 13px; margin-bottom: 20px; }
        .spm-step-icon {
          width: 42px; height: 42px; border-radius: 12px; flex-shrink: 0;
          background: linear-gradient(135deg, rgba(255,107,0,0.15), rgba(255,107,0,0.05));
          border: 1px solid rgba(255,107,0,0.2);
          display: flex; align-items: center; justify-content: center; color: #ff6b00;
        }
        .spm-step-title { font-size: 16px; font-weight: 700; color: #f5f5f7; margin: 0 0 3px; }
        .spm-step-sub { font-size: 12px; color: #6b7280; margin: 0; }
        .spm-job-pill {
          display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
          padding: 10px 14px; border-radius: 10px;
          background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.07);
          margin-bottom: 20px;
        }
        .spm-job-pill__cat {
          background: rgba(255,107,0,0.15); color: #ff9240; border-radius: 6px;
          padding: 2px 8px; font-size: 11px; font-weight: 600;
        }
        .spm-job-pill__id, .spm-job-pill__worker { font-size: 12px; color: #8a8a9a; }
        .spm-field-group { margin-bottom: 16px; }
        .spm-label { display: block; font-size: 12px; font-weight: 600; color: #9ca3af; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.04em; }
        .spm-amount-input-wrap { display: flex; align-items: center; gap: 0; border: 1.5px solid rgba(255,107,0,0.3); border-radius: 10px; overflow: hidden; background: rgba(255,255,255,0.04); transition: border-color 0.2s; }
        .spm-amount-input-wrap:focus-within { border-color: #ff6b00; }
        .spm-currency { padding: 0 12px; font-size: 18px; color: #ff6b00; font-weight: 700; }
        .spm-amount-input { flex: 1; background: transparent; border: none; outline: none; padding: 12px 12px 12px 0; font-size: 22px; font-weight: 700; color: #f5f5f7; font-family: inherit; }
        .spm-hint { font-size: 11px; color: #5c5c66; margin-top: 6px; }
        .spm-hint code { background: rgba(255,255,255,0.06); padding: 1px 5px; border-radius: 4px; font-family: monospace; color: #a0aec0; }
        .spm-breakdown {
          background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07);
          border-radius: 12px; padding: 14px; margin-bottom: 16px;
        }
        .spm-breakdown__row { display: flex; justify-content: space-between; align-items: center; padding: 4px 0; font-size: 13px; color: #9ca3af; }
        .spm-breakdown__row strong { color: #f5f5f7; }
        .spm-breakdown__fee { color: #ef4444; font-size: 12px; }
        .spm-breakdown__divider { border: none; border-top: 1px solid rgba(255,255,255,0.06); margin: 8px 0; }
        .spm-breakdown__worker strong { font-size: 15px; }
        .spm-green { color: #22c55e !important; }
        .spm-escrow-notice {
          display: flex; align-items: flex-start; gap: 8px;
          padding: 10px 14px; border-radius: 10px;
          background: rgba(234,179,8,0.06); border: 1px solid rgba(234,179,8,0.15);
          color: #ca8a04; font-size: 12px; margin-bottom: 20px;
        }
        .spm-escrow-notice svg { flex-shrink: 0; margin-top: 1px; }
        .spm-amount-badge {
          display: flex; align-items: center; gap: 8px;
          padding: 11px 14px; border-radius: 10px;
          background: rgba(255,107,0,0.08); border: 1px solid rgba(255,107,0,0.2);
          color: #ff9240; font-size: 13px; margin-bottom: 20px;
        }
        .spm-amount-badge strong { color: #fff; }
        .spm-card-wrap { margin-bottom: 16px; }
        .spm-card-element-box {
          padding: 14px; border-radius: 10px;
          border: 1.5px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.04);
          transition: border-color 0.2s;
        }
        .spm-card-element-box:focus-within { border-color: rgba(255,107,0,0.5); }
        .spm-error { color: #ef4444; font-size: 13px; margin-bottom: 14px; }
        .spm-error-box {
          padding: 10px 14px; border-radius: 10px; margin-bottom: 14px;
          background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.2);
          color: #ef4444; font-size: 13px;
        }
        .spm-actions { display: flex; gap: 10px; justify-content: flex-end; }
        .spm-btn {
          display: inline-flex; align-items: center; gap: 7px;
          padding: 10px 18px; border-radius: 10px; font-size: 13px;
          font-weight: 600; border: none; cursor: pointer; font-family: inherit; transition: all 0.2s;
        }
        .spm-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .spm-btn--primary {
          background: linear-gradient(135deg,#ff6b00,#e85d00);
          color: #fff; box-shadow: 0 4px 16px rgba(255,107,0,0.3);
        }
        .spm-btn--primary:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 6px 22px rgba(255,107,0,0.45); }
        .spm-btn--ghost {
          background: rgba(255,255,255,0.06); color: #9ca3af; border: 1px solid rgba(255,255,255,0.1);
        }
        .spm-btn--ghost:hover:not(:disabled) { background: rgba(255,255,255,0.1); color: #f5f5f7; }
        .spm-spinner {
          width: 14px; height: 14px; border-radius: 50%;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: #fff;
          animation: spm-spin 0.7s linear infinite; display: inline-block;
        }
        .spm-spinner--lg { width: 28px; height: 28px; border-width: 3px; }
        @keyframes spm-spin { to { transform: rotate(360deg) } }
        .spm-loading {
          display: flex; flex-direction: column; align-items: center;
          justify-content: center; gap: 14px; padding: 40px 0; color: #6b7280; font-size: 14px;
        }
        .spm-init-error { text-align: center; padding: 32px 0; color: #ef4444; }
        .spm-success {
          display: flex; flex-direction: column; align-items: center; text-align: center;
          padding: 30px 0 10px; gap: 10px;
        }
        .spm-success__icon { color: #22c55e; animation: spm-pop 0.5s ease; }
        @keyframes spm-pop { 0% { transform: scale(0) } 80% { transform: scale(1.15) } 100% { transform: scale(1) } }
        .spm-success h3 { font-size: 20px; font-weight: 700; color: #f5f5f7; margin: 0; }
        .spm-success p { color: #9ca3af; font-size: 14px; margin: 0; line-height: 1.6; }
        .spm-success__hint { color: #6b7280; font-size: 12px; }
        .spm-modal-footer {
          display: flex; align-items: center; justify-content: center; gap: 6px;
          padding: 12px; border-top: 1px solid rgba(255,255,255,0.05);
          color: #4b5563; font-size: 11px;
        }
      `}</style>
    </div>
  );
}
