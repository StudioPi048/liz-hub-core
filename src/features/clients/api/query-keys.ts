export const clientsQueryKeys = {
  all: ["clients"] as const,
  list: () => [...clientsQueryKeys.all, "list"] as const,
  detail: (id: string) => [...clientsQueryKeys.all, "detail", id] as const,
};
