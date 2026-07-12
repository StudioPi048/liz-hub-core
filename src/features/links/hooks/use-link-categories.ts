import { useQuery } from "@tanstack/react-query";
import { getLinkCategories } from "../api/get-link-categories";
import { linksQueryKeys } from "../api/query-keys";

export function useLinkCategories() {
  return useQuery({
    queryKey: linksQueryKeys.categories(),
    queryFn: getLinkCategories,
  });
}
