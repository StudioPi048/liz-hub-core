import { useQuery } from "@tanstack/react-query";
import { getClients } from "../api/get-clients";
import { clientsQueryKeys } from "../api/query-keys";

export function useClients() {
  return useQuery({
    queryKey: clientsQueryKeys.list(),
    queryFn: getClients,
  });
}
