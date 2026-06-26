export default function DashboardPageHeader({ title, subtitle, userName }) {
  return (
    <header className="dashboard-page-header">
      <div>
        <h1 className="dashboard-page-header__title">{title}</h1>
        {subtitle && <p className="dashboard-page-header__subtitle">{subtitle}</p>}
      </div>
      {userName && (
        <div className="dashboard-page-header__user">
          Welcome, <strong>{userName}</strong>
        </div>
      )}
    </header>
  );
}
