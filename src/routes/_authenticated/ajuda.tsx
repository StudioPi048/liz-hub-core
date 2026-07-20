import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  LayoutDashboard,
  Calendar,
  Contact,
  Receipt,
  WalletCards,
  Library,
  Sparkles,
  FileText,
  Link2,
  Settings,
  type LucideIcon,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/ajuda")({
  component: AjudaPage,
});

type Modulo = {
  id: string;
  titulo: string;
  icon: LucideIcon;
  rota: string;
  resumo: string;
  topicos: { titulo: string; texto: string }[];
};

const MODULOS: Modulo[] = [
  {
    id: "dashboard",
    titulo: "Dashboard",
    icon: LayoutDashboard,
    rota: "/dashboard",
    resumo: "Tela de abertura: um resumo rápido do dia e o que precisa de atenção.",
    topicos: [
      {
        titulo: "O que mostra",
        texto:
          "Data de hoje, 4 cartões com números (compromissos hoje, novos contatos aguardando, retornos atrasados, em acompanhamento) e os próximos 4 compromissos dos próximos 7 dias.",
      },
      {
        titulo: "Alertas Operacionais",
        texto:
          "Lista automaticamente conflitos de horário na Agenda, clientes com retorno atrasado e novos contatos (leads) aguardando resposta. Clique num alerta para ir direto resolver na Agenda ou no CRM.",
      },
      {
        titulo: "Atalhos",
        texto:
          'Botões "Ver agenda" e "Novo dossiê" no topo, mini calendário e atalhos "Planejar Semana" / "Retornar Contatos" na lateral.',
      },
    ],
  },
  {
    id: "agenda",
    titulo: "Agenda",
    icon: Calendar,
    rota: "/agenda",
    resumo: "Compromissos do Instituto, com sincronização opcional com o Google Calendar.",
    topicos: [
      {
        titulo: "Visualizações",
        texto:
          "5 formas de ver os compromissos: Hoje, Semana, Mês, Trimestre e Semestre (lista). Troque pelas abas no topo.",
      },
      {
        titulo: "Criar ou editar um compromisso",
        texto:
          'Botão "Novo Compromisso" abre um formulário: título, dia inteiro ou hora marcada, status (Confirmado, Pendente, Rascunho, Concluído, Remarcado, Cancelado), modalidade (Online, Presencial, Híbrido), local, link da reunião, cliente vinculado (busca no CRM) e observações.',
      },
      {
        titulo: "Cancelar não é apagar",
        texto:
          'Cancelar um compromisso não some com ele — só muda o status para "Cancelado" (com motivo opcional), então o histórico fica registrado.',
      },
      {
        titulo: "Google Calendar (só administradores)",
        texto:
          'O painel lateral "Painel de Bordo" mostra se a conta do Google está conectada. O botão "Sincronizar com Google Calendar" traz os eventos de lá para dentro do HUB. Eventos que vieram do Google não podem ser editados aqui — só no próprio Google Calendar.',
      },
      {
        titulo: "Filtros",
        texto:
          'Botão "Filtros" permite buscar por texto, categoria, responsável, status ou origem do evento, além de detectar automaticamente conflitos de horário.',
      },
    ],
  },
  {
    id: "clientes",
    titulo: "Clientes (CRM)",
    icon: Contact,
    rota: "/crm",
    resumo: "Cadastro de alunos e contatos do Instituto — dados pessoais, compras e histórico.",
    topicos: [
      {
        titulo: "3 abas",
        texto:
          '"Alunos" mostra quem já comprou algo (dados vêm do Faturamento — total pago, valor em aberto, cursos). "Dossiês" são contatos/leads em geral (não precisam ter comprado nada). "Fluxo por status" é um kanban simples por etapa (novo, em contato, convertido, perdido).',
      },
      {
        titulo: "Criar um dossiê",
        texto:
          'Botão "Novo dossiê": nome, telefone, e-mail, origem do contato, interesse, status e notas.',
      },
      {
        titulo: "Página do cliente",
        texto:
          "Clique num dossiê para abrir 3 abas: Visão Geral (editar dados e status), Notas (anotações livres) e Histórico (compromissos da Agenda ligados a esse cliente, com botão para criar um novo já vinculado a ele).",
      },
      {
        titulo: "Excluir",
        texto: 'Botão "Remover dossiê" pede confirmação antes de apagar — ação sem volta.',
      },
    ],
  },
  {
    id: "faturamento",
    titulo: "Faturamento",
    icon: Receipt,
    rota: "/faturamento",
    resumo:
      "O módulo mais usado no dia a dia: parcelas de vendas, cobranças, notas fiscais e relatórios.",
    topicos: [
      {
        titulo: "De onde vêm os dados",
        texto:
          'Historicamente vinham de uma planilha Excel, importada pelo botão "Enviar arquivo da planilha". Hoje o HUB já é a fonte principal — a planilha só é reenviada se precisar recarregar dados antigos. Atenção: reenviar a planilha atualiza o banco a partir dela (não é incremental linha a linha).',
      },
      {
        titulo: "Registrar uma venda nova",
        texto:
          'Botão "Nova venda": escolha o aluno (busca por nome ou CPF), o curso e o plano de pagamento — as parcelas são geradas automaticamente conforme o plano escolhido. Marque "Curso presencial" se for o caso, para a venda entrar sozinha na fila de nota fiscal.',
      },
      {
        titulo: "As 6 abas",
        texto:
          "Cobranças do mês, Em atraso, Recebidos (parcelas já pagas), Buscar cliente (procurar por nome/CPF), Notas fiscais e Relatórios.",
      },
      {
        titulo: "Dar baixa numa parcela",
        texto:
          'Botão "Marcar recebido" em qualquer parcela em aberto. Se marcar por engano, a mesma parcela (agora na aba Recebidos ou Buscar cliente) ganha um botão "Desfazer baixa" que reverte.',
      },
      {
        titulo: "Cobrar no WhatsApp",
        texto:
          "Toda parcela em aberto tem um botão que já abre o WhatsApp do cliente com uma mensagem de cobrança pronta (nome, valor, curso, vencimento).",
      },
      {
        titulo: "Notas fiscais",
        texto:
          'A fila mostra quem precisa de nota emitida. "Copiar dados" copia os dados formatados para colar no sistema Senior (Dressler); depois de emitir, digite o número da nota e clique em "Marcar como emitida".',
      },
      {
        titulo: "Relatórios",
        texto: "Gráficos de recebido por mês (últimos 12 meses) e recebido por curso (top 10).",
      },
    ],
  },
  {
    id: "financeiro",
    titulo: "Financeiro",
    icon: WalletCards,
    rota: "/financeiro",
    resumo: "Despesas do Instituto (contas a pagar) e o fluxo de caixa geral.",
    topicos: [
      {
        titulo: "Contas a pagar",
        texto:
          'Cadastre despesas (aluguel, salários, docentes etc.) com o botão "Nova despesa": descrição, fornecedor, categoria, vencimento, valor — e a opção de repetir a despesa por vários meses de uma vez. Marque como paga, edite ou exclua (exclusão pede confirmação e não tem volta) a qualquer momento.',
      },
      {
        titulo: "Por que aparece zerado no início",
        texto:
          "Essa tela não puxa nada automaticamente porque despesa é informação nova — nunca existiu em planilha nenhuma. Fica em R$ 0,00 até alguém cadastrar a primeira despesa.",
      },
      {
        titulo: "Caixa",
        texto:
          'Essa aba sim é automática: "entrou" vem das parcelas recebidas no Faturamento, "saiu" vem das despesas pagas aqui em Contas a pagar. Mostra também um gráfico de 12 meses e uma previsão dos próximos meses.',
      },
    ],
  },
  {
    id: "acervo",
    titulo: "Acervo",
    icon: Library,
    rota: "/acervo",
    resumo: "Catálogo de tudo que o Instituto vende ou produz: livros, cursos, produtos e eventos.",
    topicos: [
      {
        titulo: "Visão Geral",
        texto:
          'Cards de contagem por tipo (Livros, Cursos e formações, Produtos, Eventos, Autores, Conceitos, Perguntas frequentes), status editorial (aprovados vs. rascunhos/em revisão) e um atalho "Revisar Pendentes" para o que ainda não foi aprovado.',
      },
      {
        titulo: "Cada coleção (Livros, Cursos, Produtos, Eventos)",
        texto:
          'Busca e filtro por status de vendas na Hotmart (ativa/suspensa). Botão "Sincronizar Hotmart" atualiza os itens a partir do catálogo da Hotmart (só para cursos e produtos).',
      },
      {
        titulo: "Página de um item",
        texto:
          'Capa (trocar/baixar), categoria, botão "Vendas Abertas/Fechadas", texto e resumo editáveis (clique para editar), painel "Enriquecimento Rápido" (cole o link da Hotmart e ele importa capa/descrição automaticamente), galeria de arquivos (capas, PDFs, vídeos de aula, etc.) e conteúdo relacionado.',
      },
      {
        titulo: "Aprovar um item",
        texto:
          'Botão "Aprovar e Publicar" no topo do item marca como oficial e sai da lista de pendentes.',
      },
    ],
  },
  {
    id: "curadoria",
    titulo: "Curadoria",
    icon: Sparkles,
    rota: "/curadoria",
    resumo: "Fila de revisão de itens do Acervo antes de virarem catálogo oficial.",
    topicos: [
      {
        titulo: "As 3 colunas",
        texto: "Rascunhos (capturados) → Em Revisão (enriquecidos) → Aprovados (catálogo oficial).",
      },
      {
        titulo: "Aprovar em lote",
        texto:
          'Selecione vários itens (checkbox em cada card) e use "Aprovar e Publicar Todos" na barra que aparece embaixo — dá pra escolher um Conceito Principal para aplicar a todos de uma vez.',
      },
      {
        titulo: "Conceito individual",
        texto: "Cada card tem um seletor próprio de Conceito, que salva assim que você escolhe.",
      },
    ],
  },
  {
    id: "textos",
    titulo: "Textos",
    icon: FileText,
    rota: "/textos",
    resumo: "Biblioteca de textos prontos (respostas, divulgação) já escritos em vários tamanhos.",
    topicos: [
      {
        titulo: "Como funciona",
        texto:
          'Cada texto pode ter até 6 variações por canal: Longa, Média, Curta, Instagram, WhatsApp e E-mail. Botão "Novo" cria um texto com título, tema opcional e o conteúdo de cada variação que fizer sentido.',
      },
      {
        titulo: "Usar um texto",
        texto: 'Botão "Copiar" em cada variação copia o texto pronto para colar onde precisar.',
      },
    ],
  },
  {
    id: "links",
    titulo: "Links",
    icon: Link2,
    rota: "/links",
    resumo: "Biblioteca de links úteis do dia a dia, organizados por categoria.",
    topicos: [
      {
        titulo: "Como usar",
        texto:
          "Busque por nome ou URL, ou navegue pelos grupos de categoria. Cada link tem botões para abrir em nova aba, copiar, editar ou remover.",
      },
      {
        titulo: "Cadastrar um link",
        texto: 'Botão "Novo": nome, URL, categoria e observações opcionais.',
      },
    ],
  },
  {
    id: "configuracoes",
    titulo: "Configurações",
    icon: Settings,
    rota: "/configuracoes",
    resumo: "Seu perfil e as integrações da conta.",
    topicos: [
      {
        titulo: "Perfil",
        texto:
          "Edite nome completo, função/cargo, telefone, WhatsApp e biografia. Suas permissões (Administrador, Editor ou Visualizador) aparecem como selos ao lado do e-mail — quem define isso é a administração, não dá pra trocar sozinho aqui.",
      },
      {
        titulo: "Integrações",
        texto: "Mostra se a conta está conectada ao Google Calendar (gerenciado pela Agenda).",
      },
      {
        titulo: "Em construção",
        texto:
          '"Preferências" e "Dados Institucionais" ainda não têm funcionalidade própria — são placeholders para o futuro, assim como os itens Arquivos, Equipe, Institucional, Projetos e Prompts de IA no menu "Em construção".',
      },
    ],
  },
];

function AjudaPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-editorial tracking-tight">Central de Ajuda</h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          Um guia rápido de tudo que dá para fazer no LIZ HUB, módulo por módulo. Clique em cada
          tópico para abrir os detalhes, ou vá direto ao módulo pela sidebar.
        </p>
      </div>

      <div className="grid gap-4">
        {MODULOS.map((modulo) => {
          const Icon = modulo.icon;
          return (
            <Card key={modulo.id}>
              <CardContent className="py-5">
                <div className="flex flex-wrap items-start justify-between gap-3 mb-1">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="text-lg font-medium">{modulo.titulo}</h2>
                      <p className="text-sm text-muted-foreground">{modulo.resumo}</p>
                    </div>
                  </div>
                  <Link
                    to={modulo.rota}
                    className="text-sm text-primary hover:underline shrink-0 whitespace-nowrap"
                  >
                    Abrir {modulo.titulo} →
                  </Link>
                </div>
                <Accordion type="multiple" className="mt-2">
                  {modulo.topicos.map((topico, i) => (
                    <AccordionItem key={topico.titulo} value={`${modulo.id}-${i}`}>
                      <AccordionTrigger>{topico.titulo}</AccordionTrigger>
                      <AccordionContent className="text-muted-foreground leading-relaxed">
                        {topico.texto}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
