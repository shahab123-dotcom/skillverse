const VARIANT_MAP = {
  pending: 'badge-pending',
  assigned: 'badge-info',
  en_route: 'badge-info',
  completed: 'badge-success',
  cancelled: 'badge-error',
  canceled: 'badge-error',
  approved: 'badge-success',
  rejected: 'badge-error',
  paid: 'badge-success',
  held: 'badge-pending',
  released: 'badge-success',
  refunded: 'badge-error',
  under_review: 'badge-warning',
  searching: 'badge-pending',
  accepted: 'badge-success',
  declined: 'badge-error',
  failed: 'badge-error',
  blocked: 'badge-error',
  active: 'badge-success',
  info: 'badge-info',
};

const LABEL_MAP = {
  en_route: 'En Route',
  under_review: 'Under Review',
};

function normalizeStatus(status) {
  return String(status || 'pending').toLowerCase().replace(/\s+/g, '_');
}

export function getStatusVariant(status) {
  return VARIANT_MAP[normalizeStatus(status)] || 'badge-info';
}

export default function StatusBadge({ status, label, className = '' }) {
  const normalized = normalizeStatus(status);
  const variant = getStatusVariant(status);
  const display = label || LABEL_MAP[normalized] || String(status || 'pending').replace(/_/g, ' ');

  return (
    <span className={`badge ${variant} ${className}`.trim()}>
      {display}
    </span>
  );
}
