# Auditoria Técnica e Inventário LIZ HUB

## 1. Inventário Real de Acesso a Dados

O sistema utiliza a biblioteca `@supabase/supabase-js` diretamente no cliente (`client.ts`) e no servidor (`client.server.ts`), aliada ao `@tanstack/react-query` para gerenciar estado assíncrono.

### Ocorrências de `supabase.from` e `useQuery/useMutation`

| Arquivo | Linha | Domínio | Operação | Tabela | Tipo | Tratamento de Erro | Invalidação de Cache | Risco |
|---------|-------|---------|----------|--------|------|--------------------|----------------------|-------|
| `AppShell.tsx` | 36-45 | Auth/Perfil | `select` | `profiles`, `user_roles` | Consulta c/ Regra | Nenhum | N/A | Médio |
| `crm.tsx` | 28 | CRM | `select` | `crm_contacts` | Consulta Simples | Nenhum | N/A | Baixo |
| `crm.tsx` | 34 | CRM | `insert` | `crm_contacts` | Operação | Sim (`throw error`) | Sim (`qc.invalidateQueries`) | Médio |
| `crm.tsx` | 41 | CRM | `update` | `crm_contacts` | Operação | Nenhum | Sim (`qc.invalidateQueries`) | Médio |
| `crm.tsx` | 48 | CRM | `delete` | `crm_contacts` | Operação | Sim (`throw error`) | Sim (`qc.invalidateQueries`) | Médio |
| `dashboard.tsx` | 20 | Projetos | `select` | `projects` | Consulta Simples | Nenhum | N/A | Baixo |
| `dashboard.tsx` | 28 | CRM | `select` | `crm_contacts` | Regra de Negócio | Nenhum | N/A | Médio |
| `textos.tsx` | 29 | Biblioteca | `select` | `text_snippets` | Consulta c/ JOIN | Nenhum | N/A | Baixo |
| `textos.tsx` | 39-43 | Biblioteca | `insert` | `text_snippets` & `_variants` | Transacional | Nenhum | Sim (`qc.invalidateQueries`) | Alto |
| `textos.tsx` | 52 | Biblioteca | `delete` | `text_snippets` | Operação | Sim (`throw error`) | Sim (`qc.invalidateQueries`) | Médio |
| `links.tsx` | 26 | Links | `select` | `link_categories` | Consulta Simples | Nenhum | N/A | Baixo |
| `links.tsx` | 30 | Links | `select` | `links` | Consulta c/ JOIN | Nenhum | N/A | Baixo |
| `links.tsx` | 37 | Links | `insert` | `links` | Operação | Nenhum | Sim (`qc.invalidateQueries`) | Médio |
| `links.tsx` | 53 | Links | `delete` | `links` | Operação | Sim (`throw error`) | Sim (`qc.invalidateQueries`) | Médio |

### Ocorrências de `supabase.auth`
- `auth-attacher.ts`: `getSession()` no SSR.
- `auth-middleware.ts`: `getClaims()` para middlewares do TanStack Start.
- `auth.tsx`: `getUser()`, `onAuthStateChange()`, `signInWithPassword()`, `signUp()`.
- `__root.tsx`: `onAuthStateChange()`.
- `AppShell.tsx`: `getUser()`, `signOut()`.

**Análise**: Grande parte das queries são "Consultas Simples" (operações de leitura sem agregação complexa). Porém, há exceções transacionais (inserção de textos e variantes) que, feitas no cliente sem controle transacional robusto, apresentam **risco alto** de inconsistência de dados. O tratamento de erros é falho (muitas vezes os erros não são checados, apenas o `error` é recebido e ignorado).

---

## 2. Integração com Google Calendar

O fluxo do Google Calendar está isolado em `src/lib/google-calendar.server.ts` e `src/lib/google-calendar.functions.ts`. 

- **Geração da URL OAuth**: Feita via servidor utilizando `crypto` (HMAC sha256) para assinar um estado (`state`). O `client_id` é lido do `.env`.
- **Callback**: Um endpoint público lida com a resposta, realiza o exchange token (`exchangeCodeForTokens`), decodifica o `idToken` e armazena via `supabaseAdmin` na tabela `google_oauth_tokens`.
- **Renovação de Access Token**: A função `getValidAccessToken` verifica a validade. Se expirar em menos de 1 minuto, aciona `refreshAccessToken` diretamente na API do Google OAuth 2.0 e salva o novo token no banco.
- **Consulta de Calendários**: Requer token válido e bate em `https://www.googleapis.com/calendar/v3/users/me/calendarList`.
- **Sincronização de Eventos**: Bate no endpoint `events?timeMin&timeMax` de cada calendário retornado pela lista. O resultado é iterado e combinado com as preferências de visibilidade e cor locais salvas em `google_calendar_prefs`.
- **Tratamento de Desconexão**: Exclui fisicamente a linha de token da tabela `google_oauth_tokens` no banco.
- **Diferenças de Ambientes**: Depende pesadamente do origin na geração da URL (`redirect_uri`).

**Risco de Refatoração**: Extremo. O fluxo é sensível, depende de criptografia manual para o state e validações de servidor (`createServerFn`). Não deve ser alterado nesta fase.

---

## 3. Auditoria do Design System

A arquitetura CSS é regida pelo `styles.css` utilizando a diretiva `@theme` e `--var` do TailwindCSS v4.

### Tokens Globais (Variáveis CSS)
O sistema possui mais de 40 tokens semânticos declarados no CSS (ex: `--background`, `--foreground`, `--primary`, `--sidebar`, `--chart`).
**A abordagem atual**: Utiliza paletas de roxo (oklch) altamente saturadas em light mode e contrastes fortes em dark mode, remetendo a um dashboard padrão corporativo, contrariando a estética de "arquivo histórico/biblioteca".

### Componentes (Radix/shadcn)
O repositório possui 46 componentes no diretório `src/components/ui`. Estes componentes são gerados por padrão e utilizam Tailwind classes *inline*.
**Problemas Mapeados**:
1. Card (`card.tsx`): Usa bordas padrão cinza-claro. Faltam texturas orgânicas e sombras suaves que remetam a um artefato físico (papel/livro).
2. Typografia: O sistema usa a fonte padrão do navegador (`ui-sans-serif, system-ui`). Para a "biblioteca/museu", a tipografia é o elemento central. O estilo atual carece de uma fonte serifada (como *Newsreader* ou *Playfair Display*) para títulos ou trechos literários, mantendo sans-serif de alta legibilidade (como *Inter* ou *Geist*) apenas para UI.
3. Consistência: Cores de marcação (`border-l-4` dinâmicos em `dashboard.tsx`) são adicionadas de forma *inline*, fora do Design System.

| Elemento | Implementação Atual | Problema | Token Proposto | Risco |
|----------|---------------------|----------|----------------|-------|
| Background | `oklch(0.995 0.005 300)` (Branco gélido) | Muito corporativo/SaaS | `oklch(0.97 0.01 0)` (Off-white / Papel pardo leve) | Baixo |
| Font-Family | System-UI | Ausência de identidade | Inter (UI) + Newsreader (Heading/Leitura) | Baixo |
| Cards | Borda e background sólido | Chapado | Backgrounds levemente texturizados e sombras orgânicas | Médio |
| Primary Color | Roxo Elétrico (`oklch(0.48 0.19 295)`) | Muito digital | Roxo Profundo/Ametista Escuro | Baixo |

---

## 4. Conclusão da Auditoria

1. O acesso a dados possui domínios bem delimitados, mas implementados de forma acoplada nas rotas.
2. A integração Google Calendar é um "ponto intocável" sem cobertura de testes robusta no momento.
3. O Design System é mecanicamente impecável, mas conceitualmente desalinhado com a visão de luxo, ciência e arquivo histórico.
4. Suposições do relatório anterior foram revisadas: não existe transacionalidade segura no acesso a dados do `textos.tsx`, e o type-safety não cobre completamente os retornos caso tabelas do Supabase percam sincronia com os tipos exportados no cliente.
