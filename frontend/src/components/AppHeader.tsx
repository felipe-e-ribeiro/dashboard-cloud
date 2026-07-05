import { Link, useLocation } from "react-router-dom";

import { useAuth } from "../context/AuthContext";

export function AppHeader() {
  const { logout } = useAuth();
  const location = useLocation();
  const isLogsPage = location.pathname === "/sync-logs";

  return (
    <header className="dashboard-header">
      <h1>Cloud Cost Dashboard</h1>
      <div className="header-actions">
        <Link to={isLogsPage ? "/" : "/sync-logs"}>{isLogsPage ? "Voltar ao dashboard" : "Ver logs de sync"}</Link>
        <button onClick={() => logout()}>Sair</button>
      </div>
    </header>
  );
}
