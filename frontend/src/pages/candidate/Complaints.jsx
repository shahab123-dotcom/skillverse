import { Navigate } from 'react-router-dom';

export default function ComplaintsPage() {
  return <Navigate to="/customer" state={{ activeTab: 'complaints' }} replace />;
}
