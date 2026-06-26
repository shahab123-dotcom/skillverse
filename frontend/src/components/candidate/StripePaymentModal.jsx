import React, { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { CreditCard, X, Lock, CheckCircle, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { API_URL } from '../../App';

let stripePromise = null;

// Lazily loads stripe only when component mounts
const getStripe = async () => {
  if (!stripePromise) {
    try {
      const res = await fetch(`${API_URL}/api/payment/config`);
      if (!res.ok) {
        console.error(`Failed to fetch Stripe config: ${res.status} ${res.statusText}`);
        throw new Error(`Failed to fetch Stripe config: ${res.status}`);
      }
      const data = await res.json();
      if (!data.publishableKey) {
        console.error('No publishableKey in response:', data);
        throw new Error('Stripe publishable key not configured');
      }
      stripePromise = loadStripe(data.publishableKey);
    } catch (err) {
      console.error('Stripe initialization error:', err);
      throw err;
    }
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
      '::placeholder': { color: '#68686e' },
      iconColor: '#ff6b00'
    },
    invalid: {
      color: '#ef4444',
      iconColor: '#ef4444'
    }
  }
};

// Inner form component (must be inside <Elements>)
function CheckoutForm({ job, onSuccess, onClose }) {
  const stripe = useStripe();
  const elements = useElements();

  const [clientSecret, setClientSecret] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('idle'); // idle, processing, success, error
  const [errorMsg, setErrorMsg] = useState('');
  const [cardComplete, setCardComplete] = useState(false);
  const [useManualInput, setUseManualInput] = useState(false);
  const [showCVC, setShowCVC] = useState(false);
  
  // Manual card input fields
  const [manualCardData, setManualCardData] = useState({
    cardNumber: '',
    expiry: '',
    cvc: ''
  });

  // Create payment intent when form opens
  useEffect(() => {
    const createIntent = async () => {
      try {
        console.log('=== Creating Payment Intent ===');
        console.log('API_URL:', API_URL);
        console.log('Job ID:', job._id);
        console.log('Token exists:', !!localStorage.getItem('token'));
        
        const response = await fetch(`${API_URL}/api/payment/create-payment-intent`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({ jobId: job._id })
        });
        
        console.log('Response status:', response.status);
        console.log('Response statusText:', response.statusText);
        console.log('Response headers:', {
          'content-type': response.headers.get('content-type'),
          'content-length': response.headers.get('content-length')
        });
        
        const responseText = await response.text();
        console.log('Raw response text:', responseText);
        console.log('Response text length:', responseText.length);
        
        if (!response.ok) {
          console.error('Response not OK');
          let errorMsg = 'Failed to initialize payment';
          if (responseText) {
            try {
              const errorData = JSON.parse(responseText);
              errorMsg = errorData.error || errorMsg;
              console.error('Backend error:', errorData);
            } catch (parseErr) {
              console.error('Could not parse error response:', responseText);
              errorMsg = responseText || `Server error: ${response.status}`;
            }
          }
          setErrorMsg(errorMsg);
          setStatus('error');
          return;
        }
        
        if (!responseText) {
          console.error('Empty response from server');
          setErrorMsg('Empty response from server - backend may be down');
          setStatus('error');
          return;
        }
        
        try {
          const data = JSON.parse(responseText);
          console.log('Parsed response:', data);
          
          if (data.clientSecret) {
            setClientSecret(data.clientSecret);
            console.log('✓ Client secret received');
          } else {
            console.error('No clientSecret in response:', data);
            setErrorMsg('Invalid payment response from server');
            setStatus('error');
          }
        } catch (parseErr) {
          console.error('Failed to parse success response:', parseErr);
          console.error('Response text was:', responseText);
          setErrorMsg(`Failed to parse payment response: ${parseErr.message}`);
          setStatus('error');
        }
      } catch (err) {
        console.error('Payment initialization error:', err);
        console.error('Error message:', err.message);
        console.error('Error stack:', err.stack);
        setErrorMsg(`Network error: ${err.message}`);
        setStatus('error');
      }
    };
    createIntent();
  }, [job._id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!stripe || !clientSecret) {
      setErrorMsg('Payment system not ready. Please try again.');
      setStatus('error');
      return;
    }

    if (!cardComplete && !useManualInput) {
      setErrorMsg('Please enter valid card details');
      setStatus('error');
      return;
    }

    if (useManualInput && (!manualCardData.cardNumber || !manualCardData.expiry || !manualCardData.cvc)) {
      setErrorMsg('Please fill in all card fields');
      setStatus('error');
      return;
    }

    setLoading(true);
    setStatus('processing');
    setErrorMsg('');

    try {
      let confirmPaymentParams;

      if (useManualInput) {
        // Manual card input
        const [month, year] = manualCardData.expiry.split('/');
        confirmPaymentParams = {
          payment_method: {
            card: {
              number: manualCardData.cardNumber.replace(/\s/g, ''),
              exp_month: parseInt(month),
              exp_year: parseInt('20' + year),
              cvc: manualCardData.cvc
            },
            billing_details: {
              name: 'Skillsverse Customer'
            }
          }
        };
      } else {
        // Stripe CardElement
        const cardElement = elements.getElement(CardElement);
        if (!cardElement) {
          setErrorMsg('Card element not found');
          setStatus('error');
          setLoading(false);
          return;
        }

        confirmPaymentParams = {
          payment_method: {
            card: cardElement,
            billing_details: {
              name: 'Skillsverse Customer'
            }
          }
        };
      }

      const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, confirmPaymentParams);

      if (error) {
        setErrorMsg(error.message);
        setStatus('error');
        setLoading(false);
        return;
      }

      if (paymentIntent.status === 'succeeded') {
        // Confirm on our backend to update DB
        try {
          console.log('Confirming payment with paymentIntentId:', paymentIntent.id);
          const res = await fetch(`${API_URL}/api/payment/confirm-payment`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ jobId: job._id, paymentIntentId: paymentIntent.id })
          });
          
          console.log('Confirm payment response status:', res.status);
          
          if (res.ok) {
            const responseData = await res.json().catch(() => ({}));
            const charge = paymentIntent.charges?.data?.[0];
            const cardDetails = charge?.payment_method_details?.card;
            const paymentMethod = cardDetails
              ? `${cardDetails.brand?.toUpperCase() || 'Card'} • **** ${cardDetails.last4}`
              : paymentIntent.payment_method_types?.[0] || 'Card';
            const jobWithPayment = responseData.job
              ? { ...responseData.job, payment: { ...responseData.job.payment, method: paymentMethod } }
              : { ...job, payment: { ...job.payment, method: paymentMethod } };

            setStatus('success');
            setTimeout(() => onSuccess({ job: jobWithPayment, paymentMethod }), 2500);
          } else {
            // Handle error response safely
            try {
              const responseText = await res.text();
              console.error('Error response body:', responseText);
              if (responseText) {
                const errorData = JSON.parse(responseText);
                setErrorMsg(errorData.error || `Server error: ${res.status}`);
              } else {
                setErrorMsg(`Server error: ${res.status} ${res.statusText}`);
              }
            } catch (parseErr) {
              console.error('Error parsing error response:', parseErr);
              setErrorMsg(`Server error: ${res.status} ${res.statusText}`);
            }
            setStatus('error');
          }
        } catch (err) {
          console.error('Payment confirmation error:', err);
          setErrorMsg(err.message || 'Backend confirmation error');
          setStatus('error');
        }
      }
    } catch (err) {
      console.error('Payment processing error:', err);
      setErrorMsg(err.message || 'Payment processing failed');
      setStatus('error');
    }

    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Job Summary */}
      <div style={{ background: 'rgba(255, 107, 0, 0.06)', border: '1px solid rgba(255,107,0,0.2)', borderRadius: '12px', padding: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Service</span>
            <p style={{ color: '#fff', fontWeight: 700, fontSize: '16px', marginTop: '2px' }}>{job.category}</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Amount</span>
            <p style={{ color: 'var(--primary-orange)', fontWeight: 800, fontSize: '22px', marginTop: '2px' }}>
              PKR {job.payment.amount.toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      {/* Success State */}
      {status === 'success' && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '20px 0' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CheckCircle size={36} color="var(--success-color)" />
          </div>
          <h3 style={{ color: 'var(--success-color)', fontSize: '20px' }}>Payment Successful!</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', textAlign: 'center' }}>
            PKR {job.payment.amount.toLocaleString()} held in escrow for 1 day. Then 90% transfers to the worker; 10% is the platform fee.
          </p>
        </div>
      )}

      {/* Error Message */}
      {status === 'error' && (
        <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', padding: '12px', display: 'flex', gap: '10px', alignItems: 'center' }}>
          <AlertCircle size={16} color="var(--error-color)" />
          <span style={{ fontSize: '13px', color: 'var(--error-color)' }}>{errorMsg}</span>
        </div>
      )}

      {/* Card Input */}
      {status !== 'success' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <label style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Card Details
            </label>
            <button
              type="button"
              onClick={() => setUseManualInput(!useManualInput)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--primary-orange)',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: 600,
                textDecoration: 'underline'
              }}
            >
              {useManualInput ? 'Use Stripe Form' : 'Enter Manually'}
            </button>
          </div>

          {/* Stripe CardElement */}
          {!useManualInput && (
            <div
              style={{
                background: 'var(--bg-input)',
                border: `1px solid ${cardComplete ? 'var(--primary-orange)' : 'var(--border-grey)'}`,
                borderRadius: '12px',
                padding: '14px 16px',
                transition: 'border-color 0.2s',
                minHeight: '50px',
                display: 'flex',
                alignItems: 'center'
              }}
            >
              <CardElement
                options={CARD_ELEMENT_OPTIONS}
                onChange={(e) => setCardComplete(e.complete)}
              />
            </div>
          )}

          {/* Manual Card Input */}
          {useManualInput && (
            <>
              {/* Card Number */}
              <input
                type="text"
                placeholder="Card Number (16 digits)"
                maxLength="19"
                value={manualCardData.cardNumber}
                onChange={(e) => {
                  let value = e.target.value.replace(/\D/g, '');
                  let formatted = value.replace(/(\d{4})/g, '$1 ').trim();
                  setManualCardData({ ...manualCardData, cardNumber: formatted });
                }}
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  marginBottom: '12px',
                  background: 'var(--bg-input)',
                  border: `1px solid var(--border-grey)`,
                  borderRadius: '8px',
                  color: 'var(--text-primary)',
                  fontSize: '14px',
                  fontFamily: 'monospace',
                  letterSpacing: '2px'
                }}
              />

              {/* Expiry & CVC */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <input
                  type="text"
                  placeholder="MM/YY"
                  maxLength="5"
                  value={manualCardData.expiry}
                  onChange={(e) => {
                    let value = e.target.value.replace(/\D/g, '');
                    if (value.length >= 2) {
                      value = value.slice(0, 2) + '/' + value.slice(2, 4);
                    }
                    setManualCardData({ ...manualCardData, expiry: value });
                  }}
                  style={{
                    padding: '12px 14px',
                    background: 'var(--bg-input)',
                    border: `1px solid var(--border-grey)`,
                    borderRadius: '8px',
                    color: 'var(--text-primary)',
                    fontSize: '14px',
                    fontFamily: 'monospace'
                  }}
                />
                <div style={{ position: 'relative' }}>
                  <input
                    type={showCVC ? 'text' : 'password'}
                    placeholder="CVC (3 digits)"
                    maxLength="3"
                    value={manualCardData.cvc}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '').slice(0, 3);
                      setManualCardData({ ...manualCardData, cvc: value });
                    }}
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      paddingRight: '40px',
                      background: 'var(--bg-input)',
                      border: `1px solid var(--border-grey)`,
                      borderRadius: '8px',
                      color: 'var(--text-primary)',
                      fontSize: '14px',
                      fontFamily: 'monospace',
                      letterSpacing: '2px'
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowCVC(!showCVC)}
                    style={{
                      position: 'absolute',
                      right: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'var(--text-secondary)',
                      display: 'flex',
                      alignItems: 'center'
                    }}
                  >
                    {showCVC ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            </>
          )}

          {/* Stripe test card hint */}
          <div style={{ background: 'rgba(59, 130, 246, 0.06)', border: '1px solid rgba(59, 130, 246, 0.2)', borderRadius: '8px', padding: '12px', fontSize: '12px', color: 'var(--text-secondary)' }}>
            <strong style={{ color: '#3b82f6' }}>Test Card Details:</strong>
            <div style={{ marginTop: '8px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div>
                <strong style={{ color: '#fff', fontSize: '11px' }}>Card:</strong>
                <code style={{ background: 'rgba(59,130,246,0.1)', padding: '4px 6px', borderRadius: '4px', color: '#fff', fontSize: '11px', display: 'block', marginTop: '2px', wordBreak: 'break-all' }}>
                  4242 4242 4242 4242
                </code>
              </div>
              <div>
                <strong style={{ color: '#fff', fontSize: '11px' }}>CVC:</strong>
                <code style={{ background: 'rgba(59,130,246,0.1)', padding: '4px 6px', borderRadius: '4px', color: '#fff', fontSize: '11px', display: 'block', marginTop: '2px' }}>
                  Any 3 digits
                </code>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <strong style={{ color: '#fff', fontSize: '11px' }}>Expiry:</strong>
                <code style={{ background: 'rgba(59,130,246,0.1)', padding: '4px 6px', borderRadius: '4px', color: '#fff', fontSize: '11px', display: 'block', marginTop: '2px' }}>
                  Any future date (e.g., 12/25)
                </code>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !stripe || !clientSecret || (!useManualInput && !cardComplete) || (useManualInput && (!manualCardData.cardNumber || !manualCardData.expiry || !manualCardData.cvc))}
            className="btn btn-primary"
            style={{ width: '100%', padding: '14px', fontSize: '15px', fontWeight: '700' }}
          >
            <Lock size={15} />
            {loading ? 'Processing Payment...' : `Pay PKR ${job.payment.amount.toLocaleString()}`}
          </button>
        </>
      )}

      {/* Stripe Branding */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-muted)' }}>
        <Lock size={10} />
        Secured by <strong style={{ color: '#6772e5' }}>Stripe</strong> · 256-bit SSL Encryption
      </div>
    </form>
  );
}

// Wrapper component that loads Stripe and wraps with Elements
export default function StripePaymentModal({ job, onSuccess, onClose }) {
  const [stripeInstance, setStripeInstance] = useState(null);

  useEffect(() => {
    getStripe().then(setStripeInstance);
  }, []);

  if (!job) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        background: 'rgba(0, 0, 0, 0.80)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backdropFilter: 'blur(8px)',
        padding: '20px'
      }}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '480px',
          border: '1px solid rgba(255, 107, 0, 0.3)',
          boxShadow: '0 25px 60px rgba(0,0,0,0.6), 0 0 40px rgba(255,107,0,0.05)'
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'var(--primary-orange-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CreditCard size={18} color="var(--primary-orange)" />
            </div>
            <div>
              <h3 style={{ fontSize: '18px', fontWeight: '700' }}>Secure Payment</h3>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Skillsverse Escrow Vault</p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Stripe Elements wrapper */}
        {stripeInstance ? (
          <Elements stripe={stripeInstance}>
            <CheckoutForm job={job} onSuccess={onSuccess} onClose={onClose} />
          </Elements>
        ) : (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
            Loading Stripe...
          </div>
        )}
      </div>
    </div>
  );
}
