import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/prompts")({
  component: () => (
    <div className="max-w-3xl">
      <Card>
        <CardHeader>
          <CardTitle>Prompts de IA</CardTitle>
          <CardDescription>
            Prompts organizados por ferramenta (Lovable, GPT, Claude, Kling, Flux...).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Em construção.</p>
        </CardContent>
      </Card>
    </div>
  ),
});
