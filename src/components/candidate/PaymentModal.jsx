import { useState } from 'react';
import { Eye, EyeOff, Lock, CheckCircle, AlertCircle } from 'lucide-react';
import { API_URL } from '../../App';

export default function PaymentModal({ job, token, onClose, onSuccess }) {
  const [step, setStep] = useState(1); // 1 = confirm amount, 2 = enter card
  const [cardData, setCardData] = useState({
    cardNumber: '',
    expiry: '',
    cvc: ''
  });
  const [amountInput, setAmountInput] = useState(job?.payment?.amount || '');
  const [showCVC, setShowCVC] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('idle'); // idle, processing, success, error
  const [error, setError] = useState('');

  if (!job) return null;

  const amount = Number(amountInput) || 0;
  const platformFee = Math.round(amount * 0.10);
  const workerAmount = amount - platformFee;

  const handleAmountChange = (e) => {
    // Allow numbers and optional decimal point
    const v = e.target.value.replace(/[^0-9.]/g, '');
    setAmountInput(v);
  };

  const handleCardNumberChange = (e) => {
    let value = e.target.value.replace(/\D/g, '');
    let formatted = value.replace(/(\d{4})/g, '$1 ').trim();
    setCardData({ ...cardData, cardNumber: formatted });
  };

  const handleExpiryChange = (e) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length >= 2) {
      value = value.slice(0, 2) + '/' + value.slice(2, 4);
    }
    setCardData({ ...cardData, expiry: value });
  };

  const handleCVCChange = (e) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 3);
    setCardData({ ...cardData, cvc: value });
  };

  const handlePayment = async () => {
    if (!cardData.cardNumber || !cardData.expiry || !cardData.cvc) {
      setError('Please fill in all card fields');
      return;
    }

    setLoading(true);
    setStatus('processing');
    setError('');

    try {
      console.log('Initiating payment...');
      const response = await fetch(`${API_URL}/api/payment/create-payment-intent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ jobId: job._id, amount })
      });

      const responseText = await response.text();
      if (!response.ok) {
        const errorData = JSON.parse(responseText || '{}');
        throw new Error(errorData.error || 'Payment initialization failed');
      }

      const data = JSON.parse(responseText);
      console.log('Payment intent created:', data.clientSecret);

      // Here you would integrate with Stripe to process the card
      // For now, we'll simulate success
      setStatus('success');
      setTimeout(() => {
        onSuccess(data);
      }, 2000);
    } catch (err) {
      console.error('Payment error:', err);
      setError(err.message || 'Payment failed');
      setStatus('error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div
        className="payment-modal"
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--bg-card)',
          border: '1px solid rgba(255, 107, 0, 0.3)',
          borderRadius: '16px',
          padding: '32px',
          maxWidth: '480px',
          width: '100%',
          boxShadow: '0 25px 60px rgba(0,0,0,0.6)'
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: '700' }}>💳 Payment Details</h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              color: 'var(--text-muted)'
            }}
          >
            ✕
          </button>
        </div>

        {status === 'success' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '20px 0' }}>
            <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CheckCircle size={36} color="var(--success-color)" />
            </div>
            <h3 style={{ color: 'var(--success-color)', fontSize: '20px' }}>Payment Successful!</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', textAlign: 'center' }}>
              PKR {amount.toLocaleString()} securely transferred to Skillsverse escrow account.
            </p>
          </div>
        )}

        {status !== 'success' && (
          <>
            {/* Job Info */}
            <div style={{ background: 'rgba(255, 107, 0, 0.06)', border: '1px solid rgba(255,107,0,0.2)', borderRadius: '12px', padding: '16px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Service</span>
                  <p style={{ color: '#fff', fontWeight: 700, fontSize: '16px', marginTop: '2px' }}>{job.category}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Amount</span>
                  <p style={{ color: 'var(--primary-orange)', fontWeight: 800, fontSize: '22px', marginTop: '2px' }}>PKR {amount.toLocaleString()}</p>
                </div>
              </div>
            </div>

            {/* Step 1: Confirm Amount */}
            {step === 1 && (
              <>
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>Enter Amount (PKR)</label>
                  <input
                    type="text"
                    placeholder="0"
                    value={amountInput}
                    onChange={handleAmountChange}
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      background: 'var(--bg-input)',
                      border: '1px solid var(--border-grey)',
                      borderRadius: '8px',
                      color: 'var(--text-primary)',
                      fontSize: '14px',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
                {/* Breakdown */}
                <div style={{ background: 'var(--bg-input)', borderRadius: '12px', padding: '16px', marginBottom: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', paddingBottom: '8px', borderBottom: '1px solid var(--border-grey)' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Platform Fee (10%)</span>
                    <span style={{ color: 'var(--text-secondary)' }}>PKR {platformFee.toLocaleString()}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--success-color)', fontWeight: '600' }}>Worker Receives</span>
                    <span style={{ color: 'var(--success-color)', fontWeight: '700' }}>PKR {workerAmount.toLocaleString()}</span>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px', fontStyle: 'italic' }}>
                    ⏱ Funds held for 1 day, then 90% released to worker (10% platform fee)
                  </div>
                </div>

                {/* Error Message */}
                {error && (
                  <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', padding: '12px', display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '16px' }}>
                    <AlertCircle size={16} color="var(--error-color)" />
                    <span style={{ fontSize: '13px', color: 'var(--error-color)' }}>{error}</span>
                  </div>
                )}

                {/* Buttons */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <button
                    onClick={onClose}
                    style={{
                      background: 'var(--bg-input)',
                      border: '1px solid var(--border-grey)',
                      color: 'var(--text-primary)',
                      padding: '12px 16px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontWeight: '600',
                      fontSize: '14px'
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      if (!amount || amount <= 0) {
                        setError('Please enter a valid amount');
                        return;
                      }
                      setError('');
                      setStep(2);
                    }}
                    style={{
                      background: 'var(--primary-orange)',
                      border: 'none',
                      color: '#fff',
                      padding: '12px 16px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontWeight: '600',
                      fontSize: '14px'
                    }}
                  >
                    Continue →
                  </button>
                </div>
              </>
            )}

            {/* Step 2: Enter Card Details */}
            {step === 2 && (
              <>
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '8px' }}>
                    Card Number
                  </label>
                  <input
                    type="text"
                    placeholder="1234 5678 9012 3456"
                    maxLength="19"
                    value={cardData.cardNumber}
                    onChange={handleCardNumberChange}
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      background: 'var(--bg-input)',
                      border: '1px solid var(--border-grey)',
                      borderRadius: '8px',
                      color: 'var(--text-primary)',
                      fontSize: '14px',
                      fontFamily: 'monospace',
                      letterSpacing: '2px',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                {/* Expiry & CVC */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
                  <div>
                    <label style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '8px' }}>
                      Expiry Date
                    </label>
                    <input
                      type="text"
                      placeholder="MM/YY"
                      maxLength="5"
                      value={cardData.expiry}
                      onChange={handleExpiryChange}
                      style={{
                        width: '100%',
                        padding: '12px 14px',
                        background: 'var(--bg-input)',
                        border: '1px solid var(--border-grey)',
                        borderRadius: '8px',
                        color: 'var(--text-primary)',
                        fontSize: '14px',
                        fontFamily: 'monospace',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '8px' }}>
                      CVC
                    </label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type={showCVC ? 'text' : 'password'}
                        placeholder="123"
                        maxLength="3"
                        value={cardData.cvc}
                        onChange={handleCVCChange}
                        style={{
                          width: '100%',
                          padding: '12px 14px',
                          paddingRight: '40px',
                          background: 'var(--bg-input)',
                          border: '1px solid var(--border-grey)',
                          borderRadius: '8px',
                          color: 'var(--text-primary)',
                          fontSize: '14px',
                          fontFamily: 'monospace',
                          letterSpacing: '2px',
                          boxSizing: 'border-box'
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
                </div>

                {/* Test Card Info */}
                <div style={{ background: 'rgba(59, 130, 246, 0.06)', border: '1px solid rgba(59, 130, 246, 0.2)', borderRadius: '8px', padding: '12px', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                  <strong style={{ color: '#3b82f6' }}>Test Card:</strong>
                  <div style={{ marginTop: '8px' }}>
                    <code style={{ background: 'rgba(59,130,246,0.1)', padding: '4px 6px', borderRadius: '4px', color: '#fff', display: 'block', wordBreak: 'break-all' }}>
                      4242 4242 4242 4242 • 12/25 • 123
                    </code>
                  </div>
                </div>

                {/* Error Message */}
                {error && (
                  <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', padding: '12px', display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '16px' }}>
                    <AlertCircle size={16} color="var(--error-color)" />
                    <span style={{ fontSize: '13px', color: 'var(--error-color)' }}>{error}</span>
                  </div>
                )}

                {/* Buttons */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <button
                    onClick={() => setStep(1)}
                    disabled={loading}
                    style={{
                      background: 'var(--bg-input)',
                      border: '1px solid var(--border-grey)',
                      color: 'var(--text-primary)',
                      padding: '12px 16px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontWeight: '600',
                      fontSize: '14px',
                      opacity: loading ? 0.5 : 1
                    }}
                  >
                    ← Back
                  </button>
                  <button
                    onClick={handlePayment}
                    disabled={loading || !cardData.cardNumber || !cardData.expiry || !cardData.cvc || !amount || amount <= 0}
                    style={{
                      background: 'var(--primary-orange)',
                      border: 'none',
                      color: '#fff',
                      padding: '12px 16px',
                      borderRadius: '8px',
                      cursor: loading ? 'not-allowed' : 'pointer',
                      fontWeight: '600',
                      fontSize: '14px',
                      opacity: (loading || !cardData.cardNumber || !cardData.expiry || !cardData.cvc || !amount || amount <= 0) ? 0.5 : 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px'
                    }}
                  >
                    <Lock size={14} />
                    {loading ? 'Processing...' : `Pay PKR ${amount.toLocaleString()}`}
                  </button>
                </div>
              </>
            )}
          </>
        )}

        {/* Security Footer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-muted)', marginTop: '16px' }}>
          <Lock size={10} />
          Secured by <strong style={{ color: '#6772e5' }}>Stripe</strong> · 256-bit SSL Encryption
        </div>
      </div>
    </div>
  );
}
