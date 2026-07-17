import React from 'react';
import { ListChecks } from 'lucide-react';
import './WorkerHistory.css';
import StatusBadge from '../../components/shared/StatusBadge';
import Pagination from '../../components/shared/Pagination';
import EmptyState from '../../components/shared/EmptyState';
import { TableSkeleton } from '../../components/shared/LoadingSkeleton';

export default function WorkerHistory({
  jobsHistory,
  historyLoading,
  historyPage,
  setHistoryPage,
  itemsPerPage
}) {
  const getPaginatedItems = (items, page) => items.slice((page - 1) * itemsPerPage, page * itemsPerPage);
  const getTotalPages = (items) => Math.max(1, Math.ceil(items.length / itemsPerPage));

  const visibleHistory = getPaginatedItems(jobsHistory, historyPage);
  const historyTotalPages = getTotalPages(jobsHistory);

  return (
    <div className="card card--padded">
      <div className="section-header">
        <ListChecks size={20} color="var(--primary-orange)" />
        <div className="section-header__text">
          <h3>Service History</h3>
          <p>Your recent jobs, payments, and completed service log.</p>
        </div>
      </div>
      {historyLoading ? (
        <TableSkeleton rows={4} cols={5} />
      ) : jobsHistory.length === 0 ? (
        <EmptyState
          icon={ListChecks}
          title="No service history yet"
          description="Completed and assigned jobs will appear here."
        />
      ) : (
        <>
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-grey)', color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '12px' }}>Service</th>
                  <th style={{ padding: '12px' }}>Customer</th>
                  <th style={{ padding: '12px' }}>Date</th>
                  <th style={{ padding: '12px' }}>Status</th>
                  <th style={{ padding: '12px' }}>Payment</th>
                </tr>
              </thead>
              <tbody>
                {visibleHistory.map((job) => (
                  <tr key={job._id} style={{ borderBottom: '1px solid var(--border-grey)' }}>
                    <td style={{ padding: '12px' }}>{job.category}</td>
                    <td style={{ padding: '12px' }}>{job.customer?.name || 'Customer'}</td>
                    <td style={{ padding: '12px' }}>{new Date(job.createdAt).toLocaleDateString()}</td>
                    <td><StatusBadge status={job.status} /></td>
                    <td style={{ padding: '12px' }}>
                      {job.payment.status === 'paid' ? `Paid PKR ${job.payment.amount}` : `Held PKR ${job.payment.amount}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={historyPage}
            totalPages={historyTotalPages}
            totalItems={jobsHistory.length}
            pageSize={itemsPerPage}
            onPageChange={setHistoryPage}
            itemLabel="jobs"
          />
        </>
      )}
    </div>
  );
}
