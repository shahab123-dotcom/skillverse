import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { AlertTriangle } from 'lucide-react';

const ConfirmContext = createContext(null);

export function ConfirmProvider({ children }) {
  const [state, setState] = useState(null);
  const resolveRef = useRef(null);

  const confirm = useCallback(({ title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', danger = false }) => {
    return new Promise((resolve) => {
      resolveRef.current = resolve;
      setState({ title, message, confirmLabel, cancelLabel, danger });
    });
  }, []);

  const close = useCallback((result) => {
    setState(null);
    resolveRef.current?.(result);
    resolveRef.current = null;
  }, []);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {state && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
          <div className="confirm-dialog">
            <div className="confirm-dialog__icon">
              <AlertTriangle size={28} color="var(--warning-color)" />
            </div>
            <h3 id="confirm-title" className="confirm-dialog__title">{state.title}</h3>
            <p className="confirm-dialog__message">{state.message}</p>
            <div className="confirm-dialog__actions">
              <button type="button" className="btn btn-secondary" onClick={() => close(false)}>
                {state.cancelLabel}
              </button>
              <button
                type="button"
                className={`btn ${state.danger ? 'btn-danger' : 'btn-primary'}`}
                onClick={() => close(true)}
              >
                {state.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used within ConfirmProvider');
  return ctx;
}
