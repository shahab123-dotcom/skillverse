export default function PublicLayout({ children, title }) {
  return (
    <div className="public-page-layout">
      {title && <header className="public-page-header"><h1>{title}</h1></header>}
      <div className="public-page-body">{children}</div>
    </div>
  );
}
