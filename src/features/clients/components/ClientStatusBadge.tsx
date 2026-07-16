import { SemanticBadge } from "@/components/SemanticBadge";
import type { SemanticVariant } from "@/components/StatCard";
import type { ClientStatus } from "../types/client.types";

const STATUS_LABEL: Record<string, string> = {
  novo: "Novo contato",
  "em contato": "Em acompanhamento",
  convertido: "Convertido",
  perdido: "Perdido",
};

const STATUS_VARIANT: Record<string, SemanticVariant> = {
  novo: "pending",
  "em contato": "neutral",
  convertido: "success",
  perdido: "critical",
};

export function ClientStatusBadge({ status }: { status: string }) {
  const variant = STATUS_VARIANT[status] ?? "neutral";
  const label = STATUS_LABEL[status] ?? status;
  return <SemanticBadge variant={variant}>{label}</SemanticBadge>;
}

export function clientStatusLabel(status: ClientStatus | string) {
  return STATUS_LABEL[status] ?? status;
}
