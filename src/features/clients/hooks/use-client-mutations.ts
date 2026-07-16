import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "../api/create-client";
import { updateClient } from "../api/update-client";
import { deleteClient } from "../api/delete-client";
import { clientsQueryKeys } from "../api/query-keys";

export function useCreateClient() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: createClient,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: clientsQueryKeys.list() });
    },
  });
}

export function useUpdateClient() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: updateClient,
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: clientsQueryKeys.list() });
      qc.invalidateQueries({ queryKey: clientsQueryKeys.detail(variables.id) });
    },
  });
}

export function useDeleteClient() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: deleteClient,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: clientsQueryKeys.list() });
    },
  });
}
