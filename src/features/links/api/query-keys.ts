export const linksQueryKeys = {
  all: ["links"] as const,
  list: () => [...linksQueryKeys.all, "list"] as const,
  categories: () => [...linksQueryKeys.all, "categories"] as const,
};
