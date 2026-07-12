import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/acervo")({
  component: () => (
    <div className="flex flex-col min-h-full">
      <Outlet />
    </div>
  ),
});
