import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/financeiro")({
  component: () => (
    <div className="max-w-3xl">
      <Card>
        <CardHeader>
          <CardTitle>Financeiro</CardTitle>
          <CardDescription>Entradas, saídas, boletos e mensalidades.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Em construção.</p>
        </CardContent>
      </Card>
    </div>
  ),
});
