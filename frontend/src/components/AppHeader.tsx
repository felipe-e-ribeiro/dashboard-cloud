import { Link, useLocation } from "react-router-dom";

import { useAuth } from "../context/AuthContext";
import { useCurrency } from "../context/CurrencyContext";
import { useTheme } from "../context/ThemeContext";

export function AppHeader() {
  const { logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { currency, toggleCurrency } = useCurrency();
  const location = useLocation();
  const isLogsPage = location.pathname === "/sync-logs";

  return (
    <header className="dashboard-header">
      <h1>Cloud Cost Dashboard</h1>
      <div className="header-actions">
        <button
          className="currency-toggle"
          onClick={toggleCurrency}
          aria-label={currency === "usd" ? "Mudar para Real" : "Mudar para Dólar"}
        >
          {currency === "usd" ? "USD" : "BRL"}
        </button>
        <button
          className="theme-toggle"
          onClick={toggleTheme}
          aria-label={theme === "dark" ? "Mudar para tema claro" : "Mudar para tema escuro"}
        >
          {theme === "dark" ? "☀️ Claro" : "🌙 Escuro"}
        </button>
        <Link to={isLogsPage ? "/" : "/sync-logs"}>{isLogsPage ? "Voltar ao dashboard" : "Ver logs de sync"}</Link>
        <button onClick={() => logout()}>Sair</button>
      </div>
    </header>
  );
}
