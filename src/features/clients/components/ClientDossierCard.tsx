import { Link } from "@tanstack/react-router";
import { Mail, Phone } from "lucide-react";
import { ClientStatusBadge } from "./ClientStatusBadge";
import type { Client } from "../types/client.types";
import { formatRelativeDate } from "../utils/format-date";

export function ClientDossierCard({ client }: { client: Client }) {
  const initials = client.name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return (
    <Link
      to="/crm/$id"
      params={{ id: client.id }}
      className="group flex items-start gap-4 rounded-lg border border-border/60 bg-card px-4 py-3.5 transition-colors hover:border-primary/40 hover:bg-accent/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold font-editorial text-muted-foreground">
        {initials || "?"}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate font-editorial text-[15px] text-foreground">{client.name}</span>
          <ClientStatusBadge status={client.status} />
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {client.phone && (
            <span className="inline-flex items-center gap-1">
              <Phone className="h-3 w-3" /> {client.phone}
            </span>
          )}
          {client.email && (
            <span className="inline-flex items-center gap-1">
              <Mail className="h-3 w-3" /> {client.email}
            </span>
          )}
          {client.interest && <span>Interesse: {client.interest}</span>}
        </div>
      </div>
      <div className="hidden shrink-0 text-right text-xs text-muted-foreground sm:block">
        <div>Último contato</div>
        <div className="font-medium text-foreground/80">
          {formatRelativeDate(client.last_contact_at) ?? "Sem registro"}
        </div>
      </div>
    </Link>
  );
}
