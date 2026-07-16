import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";

// Mock dependencies before importing the component
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => () => ({}),
  useSearch: () => ({}),
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn().mockReturnValue({ mutate: vi.fn() }),
  useQueryClient: () => ({ invalidateQueries: vi.fn(), removeQueries: vi.fn() }),
  QueryClient: vi.fn(),
  QueryClientProvider: ({ children }: any) => React.createElement("div", null, children),
}));

// AgendaEventDialog (rendered by AgendaPage) pulls in the real
// src/features/agenda/api/agenda-events.functions.ts module, whose top-level
// `createServerFn(...).middleware([requireSupabaseAuth])...` chain — and
// requireSupabaseAuth's own `createMiddleware(...)` — must resolve to
// *something* at import time. None of it actually runs in these tests
// (useQuery/useMutation/useServerFn are all mocked below), so simple
// chainable stubs are enough.
vi.mock("@tanstack/react-start", () => {
  const chainable: any = {
    middleware: () => chainable,
    inputValidator: () => chainable,
    validator: () => chainable,
    handler: () => vi.fn(),
  };
  return {
    useServerFn: vi.fn().mockReturnValue(vi.fn()),
    createServerFn: () => chainable,
    createMiddleware: () => ({ server: () => ({}) }),
  };
});

// Mock the actual functions
vi.mock("@/lib/google-calendar.functions", () => ({
  getGoogleStatus: vi.fn(),
  getGoogleAuthUrl: vi.fn(),
  disconnectGoogle: vi.fn(),
  getAgendaEvents: vi.fn(),
  syncGoogleCalendarToDatabase: vi.fn(),
}));

import { useQuery } from "@tanstack/react-query";
import { AgendaPage } from "./agenda";

// A agenda local (tabela `agenda_events`) é sempre consultada, independentemente
// do status da integração com o Google Calendar — a integração é apenas uma
// fonte de sincronização, não um pré-requisito para ver a agenda. Estes testes
// refletem esse contrato atual (ver src/routes/_authenticated/agenda.tsx).
describe("AgendaPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const getEventsQueryCall = () => {
    return (useQuery as any).mock.calls.find((call: any) => call[0].queryKey[0] === "events");
  };

  function mockGoogleStatus(data: any, extra: Record<string, any> = {}) {
    (useQuery as any).mockImplementation(({ queryKey }: any) => {
      if (queryKey[0] === "google-status") {
        return { data, refetch: vi.fn(), isLoading: false, ...extra };
      }
      if (queryKey[0] === "events") {
        return { data: { events: [] }, isLoading: false, refetch: vi.fn() };
      }
      return {};
    });
  }

  it("busca a agenda local independentemente do status da integração Google", () => {
    mockGoogleStatus({ status: "disconnected", reason: "not_connected" });

    render(React.createElement(AgendaPage));
    const eventsCall = getEventsQueryCall();

    expect(eventsCall).toBeTruthy();
    // Não há gate de `enabled` — a agenda local é sempre buscada.
    expect(eventsCall[0].enabled).not.toBe(false);
    expect(eventsCall[0].queryKey[0]).toBe("events");
  });

  it("Painel de Bordo aparece para administradores conectados", () => {
    mockGoogleStatus({ status: "connected", isAdmin: true });

    render(React.createElement(AgendaPage));

    expect(screen.getByText("Painel de Bordo")).toBeInTheDocument();
    expect(screen.getByText("Sincronizado")).toBeInTheDocument();
  });

  it("Painel de Bordo não aparece para usuários sem privilégio de administrador", () => {
    mockGoogleStatus({ status: "connected", isAdmin: false });

    render(React.createElement(AgendaPage));

    expect(screen.queryByText("Painel de Bordo")).not.toBeInTheDocument();
  });

  it("Desconectado (admin) exibe aviso para conectar a integração", () => {
    mockGoogleStatus({ status: "disconnected", reason: "not_connected", isAdmin: true });

    render(React.createElement(AgendaPage));

    expect(
      screen.getByText("Sua agenda externa está desconectada. Conecte para visualizar eventos."),
    ).toBeInTheDocument();
  });

  it("needs_reconnect (admin) exibe aviso de reconexão", () => {
    mockGoogleStatus({ status: "needs_reconnect", reason: "invalid_grant", isAdmin: true });

    render(React.createElement(AgendaPage));

    expect(
      screen.getByText(
        "A conexão com o Google Calendar expirou ou ficou inválida. Reconecte sua conta para voltar a visualizar os eventos externos.",
      ),
    ).toBeInTheDocument();
  });
});
