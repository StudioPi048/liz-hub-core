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
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
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

  it('renders layout and reconnect notice when Google is disconnected', () => {
    // Mock the useQuery hook to return disconnected status
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

    // Layout features
    expect(screen.getByText('Painel de Bordo')).toBeInTheDocument();
    
    // Disconnect notice in sidebar
    expect(screen.getByText('Sua agenda externa está desconectada. Conecte para visualizar eventos.')).toBeInTheDocument();
    
    // Internal events empty state
    expect(screen.getByText('Sem compromissos')).toBeInTheDocument();
    expect(screen.getByText('Nenhum evento interno localizado. Conecte o Google Calendar para ver eventos externos.')).toBeInTheDocument();
  });

  it('renders temporarily unavailable notice without blocking layout', () => {
    (useQuery as any).mockImplementation(({ queryKey }: any) => {
      if (queryKey[0] === 'google-status') {
        return { data: { status: 'temporarily_unavailable', reason: 'google_unavailable' }, refetch: vi.fn() };
      }
      if (queryKey[0] === 'events') {
        return { data: { events: [] }, isLoading: false, refetch: vi.fn() };
      }
      return {};
    });

    render(React.createElement(AgendaPage));

    expect(screen.getByText('Painel de Bordo')).toBeInTheDocument();
    expect(screen.getByText('Aviso de Sincronização')).toBeInTheDocument();
    expect(screen.getByText(/O servidor do Google está temporariamente indisponível/)).toBeInTheDocument();
  });
  
  it('renders expired token notice without blocking layout', () => {
    (useQuery as any).mockImplementation(({ queryKey }: any) => {
      if (queryKey[0] === 'google-status') {
        return { data: { status: 'needs_reconnect', reason: 'invalid_client' }, refetch: vi.fn() };
      }
      if (queryKey[0] === 'events') {
        return { data: { events: [] }, isLoading: false, refetch: vi.fn() };
      }
      return {};
    });

    render(React.createElement(AgendaPage));

    expect(screen.getByText('Painel de Bordo')).toBeInTheDocument();
    expect(screen.getByText('Conexão Expirada')).toBeInTheDocument();
    expect(screen.getByText(/A conexão com o Google Calendar expirou ou ficou inválida/)).toBeInTheDocument();
  });
});
