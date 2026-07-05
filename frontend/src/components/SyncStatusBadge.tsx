import { SyncStatus } from "../api/client";

function formatTimestamp(value: string | null): string {
  if (!value) return "nunca sincronizado";
  return new Date(value).toLocaleString("pt-BR");
}

export function SyncStatusBadge({ status }: { status: SyncStatus }) {
  return (
    <div className="sync-status">
      <span>Última sincronização: {formatTimestamp(status.finished_at)}</span>
      {status.status === "failed" && (
        <span role="alert" className="sync-warning">
          Falha na última sincronização: {status.error_message}
        </span>
      )}
    </div>
  );
}
