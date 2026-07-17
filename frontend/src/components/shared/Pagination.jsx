import './Pagination.css';

export default function Pagination({ page, totalPages, totalItems, pageSize, onPageChange, itemLabel = 'items' }) {
  if (totalPages <= 1) return null;

  const showing = Math.min(totalItems, page * pageSize);

  return (
    <div className="pagination">
      <span className="pagination__info">
        Showing {showing} of {totalItems} {itemLabel}
      </span>
      <div className="pagination__controls">
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          disabled={page === 1}
          onClick={() => onPageChange(page - 1)}
        >
          Previous
        </button>
        <span className="pagination__page">
          Page {page} of {totalPages}
        </span>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          disabled={page === totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}
