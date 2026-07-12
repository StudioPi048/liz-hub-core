import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createLink } from "../api/create-link";
import { deleteLink } from "../api/delete-link";
import { linksQueryKeys } from "../api/query-keys";

export function useCreateLink() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: createLink,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: linksQueryKeys.list() });
    },
  });
}

export function useDeleteLink() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: deleteLink,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: linksQueryKeys.list() });
    },
  });
}
