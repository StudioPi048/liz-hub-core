import { useEffect, useState } from "react";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Save, XCircle, ExternalLink, Info } from "lucide-react";
import { toast } from "sonner";
import { useClients } from "@/features/clients";
import {
  useCreateAgendaEvent,
  useUpdateAgendaEvent,
  useCancelAgendaEvent,
  type AgendaEventFormInput,
} from "../hooks/use-agenda-event-mutations";
import type { AgendaEvent } from "../model/agenda-event";

const STATUS_OPTIONS: { value: AgendaEventFormInput["status"]; label: string }[] = [
  { value: "confirmed", label: "Confirmado" },
  { value: "pending", label: "Pendente" },
  { value: "draft", label: "Rascunho" },
  { value: "completed", label: "Concluído" },
  { value: "rescheduled", label: "Remarcado" },
  { value: "cancelled", label: "Cancelado" },
];

const MODALITY_OPTIONS: { value: string; label: string }[] = [
  { value: "none", label: "Não informado" },
  { value: "online", label: "Online" },
  { value: "in_person", label: "Presencial" },
  { value: "hybrid", label: "Híbrido" },
];

function toDateInput(iso: string) {
  return format(new Date(iso), "yyyy-MM-dd");
}
function toTimeInput(iso: string) {
  return format(new Date(iso), "HH:mm");
}
function combine(date: string, time: string) {
  return new Date(`${date}T${time || "00:00"}:00`).toISOString();
}

type FormState = {
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  allDay: boolean;
  status: AgendaEventFormInput["status"];
  modality: string;
  location: string;
  meetingUrl: string;
  notes: string;
  clientId: string;
};

function emptyForm(initialDate?: Date, initialClientId?: string): FormState {
  const d = initialDate ?? new Date();
  return {
    title: "",
    date: format(d, "yyyy-MM-dd"),
    startTime: "09:00",
    endTime: "10:00",
    allDay: false,
    status: "confirmed",
    modality: "none",
    location: "",
    meetingUrl: "",
    notes: "",
    clientId: initialClientId || "none",
  };
}

function formFromEvent(event: AgendaEvent): FormState {
  return {
    title: event.title,
    date: toDateInput(event.startsAt),
    startTime: toTimeInput(event.startsAt),
    endTime: toTimeInput(event.endsAt),
    allDay: event.allDay,
    status: (event.status as AgendaEventFormInput["status"]) ?? "confirmed",
    modality: event.modality ?? "none",
    location: event.location ?? "",
    meetingUrl: event.meetingUrl ?? "",
    notes: event.notes ?? "",
    clientId: event.source === "agenda" && event.sourceRecordId ? event.sourceRecordId : "none",
  };
}

interface AgendaEventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: AgendaEvent | null;
  initialDate?: Date;
  /** Pré-vincula um novo compromisso a um cliente (usado a partir do dossiê). */
  initialClientId?: string;
}

export function AgendaEventDialog({
  open,
  onOpenChange,
  event,
  initialDate,
  initialClientId,
}: AgendaEventDialogProps) {
  const isEditMode = Boolean(event);
  const isReadOnly = isEditMode && event ? !event.isEditable : false;

  const [form, setForm] = useState<FormState>(() =>
    event ? formFromEvent(event) : emptyForm(initialDate, initialClientId),
  );
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  useEffect(() => {
    if (open) {
      setForm(event ? formFromEvent(event) : emptyForm(initialDate, initialClientId));
      setShowCancelConfirm(false);
      setCancelReason("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, event?.id]);

  const { data: clients } = useClients();
  const createEvent = useCreateAgendaEvent();
  const updateEvent = useUpdateAgendaEvent();
  const cancelEvent = useCancelAgendaEvent();

  const isPending = createEvent.isPending || updateEvent.isPending || cancelEvent.isPending;

  function buildPayload(): AgendaEventFormInput {
    return {
      title: form.title.trim(),
      startsAt: form.allDay ? combine(form.date, "00:00") : combine(form.date, form.startTime),
      endsAt: form.allDay ? combine(form.date, "23:59") : combine(form.date, form.endTime),
      allDay: form.allDay,
      status: form.status,
      modality:
        form.modality === "none" ? null : (form.modality as AgendaEventFormInput["modality"]),
      location: form.location.trim() || null,
      meetingUrl: form.meetingUrl.trim() || null,
      notes: form.notes.trim() || null,
      clientId: form.clientId === "none" ? null : form.clientId,
    };
  }

  function handleSave() {
    if (!form.title.trim()) {
      toast.error("Informe um título para o compromisso.");
      return;
    }
    const payload = buildPayload();

    if (isEditMode && event) {
      updateEvent.mutate(
        { ...payload, id: event.id },
        {
          onSuccess: () => {
            toast.success("Compromisso atualizado");
            onOpenChange(false);
          },
          onError: (e: Error) => toast.error(e.message),
        },
      );
    } else {
      createEvent.mutate(payload, {
        onSuccess: () => {
          toast.success("Compromisso criado");
          onOpenChange(false);
        },
        onError: (e: Error) => toast.error(e.message),
      });
    }
  }

  function handleCancelEvent() {
    if (!event) return;
    cancelEvent.mutate(
      { id: event.id, reason: cancelReason.trim() || null },
      {
        onSuccess: () => {
          toast.success("Compromisso cancelado");
          onOpenChange(false);
        },
        onError: (e: Error) => toast.error(e.message),
      },
    );
  }

  const linkedClient = clients?.find((c) => c.id === form.clientId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditMode ? (isReadOnly ? "Compromisso" : "Editar compromisso") : "Novo compromisso"}
          </DialogTitle>
          <DialogDescription>
            {isReadOnly
              ? "Este compromisso foi sincronizado do Google Calendar."
              : "Preencha os dados do compromisso. Data, horário e local são visíveis por toda a equipe."}
          </DialogDescription>
        </DialogHeader>

        {isReadOnly ? (
          <div className="space-y-4">
            <div className="flex items-start gap-2 rounded-lg border border-border/60 bg-muted/30 p-3 text-sm text-muted-foreground">
              <Info className="h-4 w-4 mt-0.5 shrink-0" />
              <span>
                Editável apenas no Google Calendar. Faça a alteração por lá e use o botão
                "Sincronizar" na Agenda para atualizar aqui.
              </span>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Título</Label>
              <p className="font-medium">{event?.title}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs text-muted-foreground">Data</Label>
                <p>{form.date}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Horário</Label>
                <p>{form.allDay ? "Dia inteiro" : `${form.startTime} - ${form.endTime}`}</p>
              </div>
            </div>
            {form.location && (
              <div>
                <Label className="text-xs text-muted-foreground">Local</Label>
                <p>{form.location}</p>
              </div>
            )}
            {event?.meetingUrl && (
              <Button variant="outline" size="sm" asChild>
                <a href={event.meetingUrl} target="_blank" rel="noreferrer">
                  <ExternalLink className="h-3.5 w-3.5" /> Abrir link da reunião
                </a>
              </Button>
            )}
          </div>
        ) : showCancelConfirm ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Tem certeza que deseja cancelar <strong>{event?.title}</strong>? O compromisso
              permanece registrado com status "Cancelado" — nada é excluído.
            </p>
            <div>
              <Label htmlFor="cancel-reason">Motivo (opcional)</Label>
              <Textarea
                id="cancel-reason"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Ex: cliente remarcou, conflito de agenda..."
              />
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <Label htmlFor="ev-title">Título</Label>
              <Input
                id="ev-title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Ex: Sessão com Maria, Mentoria Turma 4..."
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border/50 px-3 py-2">
              <Label htmlFor="ev-allday" className="cursor-pointer">
                Dia inteiro
              </Label>
              <Switch
                id="ev-allday"
                checked={form.allDay}
                onCheckedChange={(v) => setForm({ ...form, allDay: v })}
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label htmlFor="ev-date">Data</Label>
                <Input
                  id="ev-date"
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                />
              </div>
              {!form.allDay && (
                <>
                  <div>
                    <Label htmlFor="ev-start">Início</Label>
                    <Input
                      id="ev-start"
                      type="time"
                      value={form.startTime}
                      onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="ev-end">Fim</Label>
                    <Input
                      id="ev-end"
                      type="time"
                      value={form.endTime}
                      onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                    />
                  </div>
                </>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="ev-status">Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(v) =>
                    setForm({ ...form, status: v as AgendaEventFormInput["status"] })
                  }
                >
                  <SelectTrigger id="ev-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="ev-modality">Modalidade</Label>
                <Select
                  value={form.modality}
                  onValueChange={(v) => setForm({ ...form, modality: v })}
                >
                  <SelectTrigger id="ev-modality">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MODALITY_OPTIONS.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {form.modality !== "online" && (
              <div>
                <Label htmlFor="ev-location">Local</Label>
                <Input
                  id="ev-location"
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                  placeholder="Endereço ou nome do espaço"
                />
              </div>
            )}
            {form.modality !== "in_person" && (
              <div>
                <Label htmlFor="ev-link">Link da reunião</Label>
                <Input
                  id="ev-link"
                  value={form.meetingUrl}
                  onChange={(e) => setForm({ ...form, meetingUrl: e.target.value })}
                  placeholder="https://meet.google.com/..."
                />
              </div>
            )}

            <div>
              <Label htmlFor="ev-client">Cliente vinculado (opcional)</Label>
              <Select
                value={form.clientId}
                onValueChange={(v) => setForm({ ...form, clientId: v })}
              >
                <SelectTrigger id="ev-client">
                  <SelectValue placeholder="Nenhum" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {(clients ?? []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {linkedClient && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Vinculado ao dossiê de {linkedClient.name}.
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="ev-notes">Observações</Label>
              <Textarea
                id="ev-notes"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Notas internas sobre este compromisso..."
              />
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          {isEditMode && !isReadOnly && !showCancelConfirm && (
            <Button
              variant="ghost"
              className="text-[var(--semantic-critical-fg)]"
              onClick={() => setShowCancelConfirm(true)}
              disabled={isPending}
            >
              <XCircle className="h-4 w-4" /> Cancelar compromisso
            </Button>
          )}
          <div className="flex gap-2 ml-auto">
            {showCancelConfirm ? (
              <>
                <Button
                  variant="outline"
                  onClick={() => setShowCancelConfirm(false)}
                  disabled={isPending}
                >
                  Voltar
                </Button>
                <Button variant="destructive" onClick={handleCancelEvent} disabled={isPending}>
                  {cancelEvent.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Confirmar cancelamento"
                  )}
                </Button>
              </>
            ) : isReadOnly ? (
              <Button variant="secondary" onClick={() => onOpenChange(false)}>
                Fechar
              </Button>
            ) : (
              <Button onClick={handleSave} disabled={isPending}>
                {isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {isEditMode ? "Salvar alterações" : "Criar compromisso"}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
