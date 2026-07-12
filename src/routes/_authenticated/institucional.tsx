import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/institucional")({
  component: () => (
    <div className="max-w-3xl">
      <Card>
        <CardHeader>
          <CardTitle>Biblioteca Institucional</CardTitle>
          <CardDescription>Missão, valores, biografias, logos, manual de marca.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Em construção.</p>
        </CardContent>
      </Card>
    </div>
  ),
});
