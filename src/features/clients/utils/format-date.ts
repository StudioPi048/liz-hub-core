import { format, formatDistanceToNow, isValid } from "date-fns";
import { ptBR } from "date-fns/locale";

export function formatRelativeDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  if (!isValid(date)) return null;
  return formatDistanceToNow(date, { addSuffix: true, locale: ptBR });
}

export function formatFullDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  if (!isValid(date)) return null;
  return format(date, "d 'de' MMMM 'de' yyyy, HH:mm", { locale: ptBR });
}
