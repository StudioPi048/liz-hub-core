import { useQuery } from "@tanstack/react-query";
import { getClient } from "../api/get-client";
import { clientsQueryKeys } from "../api/query-keys";

export function useClient(id: string) {
  return useQuery({
    queryKey: clientsQueryKeys.detail(id),
    queryFn: () => getClient(id),
    enabled: Boolean(id),
  });
}
