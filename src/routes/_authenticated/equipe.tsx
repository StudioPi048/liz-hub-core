import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/equipe")({ component: () => (
  <div className="max-w-3xl">
    <Card>
      <CardHeader><CardTitle>Equipe</CardTitle><CardDescription>Colaboradores, telefones, responsabilidades e agenda de cada um.</CardDescription></CardHeader>
      <CardContent><p className="text-sm text-muted-foreground">Em construção.</p></CardContent>
    </Card>
  </div>
) });
