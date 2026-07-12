import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

// Mock dependencies before importing the component
vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => () => ({}),
  useSearch: () => ({}),
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn().mockReturnValue({ mutate: vi.fn() }),
  useQueryClient: () => ({ invalidateQueries: vi.fn(), removeQueries: vi.fn() }),
  QueryClient: vi.fn(),
  QueryClientProvider: ({ children }: any) => React.createElement('div', null, children),
}));

vi.mock('@tanstack/react-start', () => ({
  useServerFn: vi.fn().mockReturnValue(vi.fn()),
}));

// Mock the actual functions
vi.mock('@/lib/google-calendar.functions', () => ({
  getGoogleStatus: vi.fn(),
  getGoogleAuthUrl: vi.fn(),
  disconnectGoogle: vi.fn(),
  listRangeEvents: vi.fn(),
}));

import { useQuery } from '@tanstack/react-query';
import { AgendaPage } from './agenda';

describe('AgendaPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const getEventsQueryCall = () => {
    return (useQuery as any).mock.calls.find((call: any) => call[0].queryKey[0] === 'events');
  };

  it('Status ainda carregando -> eventsQuery não executa (enabled: false)', () => {
    (useQuery as any).mockImplementation(({ queryKey }: any) => {
      if (queryKey[0] === 'google-status') {
        return { data: undefined, refetch: vi.fn(), isLoading: true };
      }
      if (queryKey[0] === 'events') {
        return { data: { events: [] }, isLoading: false, refetch: vi.fn() };
      }
      return {};
    });

    render(React.createElement(AgendaPage));
    const eventsCall = getEventsQueryCall();
    expect(eventsCall[0].enabled).toBe(false);
  });

  it('Desconectado -> eventsQuery não executa (enabled: false) mas a Agenda renderiza', () => {
    (useQuery as any).mockImplementation(({ queryKey }: any) => {
      if (queryKey[0] === 'google-status') {
        return { data: { status: 'disconnected', reason: 'not_connected' }, refetch: vi.fn() };
      }
      if (queryKey[0] === 'events') {
        return { data: { events: [] }, isLoading: false, refetch: vi.fn() };
      }
      return {};
    });

    render(React.createElement(AgendaPage));
    
    // Verifica enabled
    const eventsCall = getEventsQueryCall();
    expect(eventsCall[0].enabled).toBe(false);

    // Verifica renderização da Agenda Interna (Cockpit)
    expect(screen.getByText('Painel de Bordo')).toBeInTheDocument();
    expect(screen.getByText('Sua agenda externa está desconectada. Conecte para visualizar eventos.')).toBeInTheDocument();
  });

  it('Conectado -> eventsQuery executa (enabled: true)', () => {
    (useQuery as any).mockImplementation(({ queryKey }: any) => {
      if (queryKey[0] === 'google-status') {
        return { data: { status: 'connected' }, refetch: vi.fn() };
      }
      if (queryKey[0] === 'events') {
        return { data: { events: [] }, isLoading: false, refetch: vi.fn() };
      }
      return {};
    });

    render(React.createElement(AgendaPage));
    
    const eventsCall = getEventsQueryCall();
    expect(eventsCall[0].enabled).toBe(true);
  });
  
  it('Reconexão (mudança de status) reflete no queryKey', () => {
    (useQuery as any).mockImplementation(({ queryKey }: any) => {
      if (queryKey[0] === 'google-status') {
        return { data: { status: 'connected' }, refetch: vi.fn() };
      }
      if (queryKey[0] === 'events') {
        return { data: { events: [] }, isLoading: false, refetch: vi.fn() };
      }
      return {};
    });

    render(React.createElement(AgendaPage));
    const eventsCall = getEventsQueryCall();
    // O queryKey tem o status na última posição
    expect(eventsCall[0].queryKey).toContain('connected');
  });
});
