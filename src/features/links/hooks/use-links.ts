import { useQuery } from "@tanstack/react-query";
import { getLinks } from "../api/get-links";
import { linksQueryKeys } from "../api/query-keys";

export function useLinks() {
  return useQuery({
    queryKey: linksQueryKeys.list(),
    queryFn: getLinks,
  });
}
