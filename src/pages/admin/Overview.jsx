export default function Overview({ workersCount, jobsCount, paymentsStats }) {
  return (
    <section id="overview" className="card dashboard-section overview-section">
      <div className="section-header">
        <h2>Administration Overview</h2>
        <p>Track platform adoption, escrow performance, and active job volume in one place.</p>
      </div>
      <div className="overview-grid">
        <div className="overview-card">
          <span>Total Workers</span>
          <strong>{workersCount}</strong>
        </div>
        <div className="overview-card">
          <span>Total Jobs</span>
          <strong>{jobsCount}</strong>
        </div>
        <div className="overview-card">
          <span>Escrow Held</span>
          <strong>{paymentsStats.pendingEarnings} PKR</strong>
        </div>
        <div className="overview-card">
          <span>Released Payments</span>
          <strong>{paymentsStats.totalEarnings} PKR</strong>
        </div>
      </div>
    </section>
  );
}
