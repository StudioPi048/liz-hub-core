# Plano de Implementação 01: Fundação Arquitetural e Design System

## A. Escopo
Este plano define a execução do primeiro lote de melhorias arquiteturais e de interface do LIZ HUB, dividindo o trabalho em duas frentes independentes. 

**O que está INCLUSO:**
- Criação de uma estrutura baseada em *Feature Slices* (`src/features/*`) para encapsular o acesso a dados.
- Refatoração completa de **um** domínio-piloto (Links) para utilizar a nova arquitetura de features.
- Atualização dos tokens globais de CSS (`styles.css`) para refletir a estética "Biblioteca/Arquivo Histórico".
- Aplicação dos tokens visuais em **uma** tela-piloto (Links), sem alterar a estrutura profunda de layout.

**O que está EXCLUÍDO:**
- Alterações no Google Calendar e Agenda (Área Crítica).
- Implementações envolvendo IA (Embeddings, `pgvector`, buscas semânticas).
- Refatoração dos demais domínios (CRM, Textos, Projetos, etc.) nesta fase.

---

## B. Diagnóstico com Evidências
O documento `docs/architecture/technical-audit.md` detalha o inventário. Resumidamente:
- **Acesso a Dados Acoplado**: O arquivo `src/routes/_authenticated/links.tsx` possui 4 chamadas `supabase.from()` diretas e realiza mutations e queries com `useQuery/useMutation` declaradas diretamente no corpo do componente.
- **Tratamento de Erro Ausente**: Falhas na leitura do Supabase retornam arrays vazios silenciosamente (`.data || []`), o que mascara instabilidades.
- **Design System Genérico**: `styles.css` utiliza tokens `oklch` de alto contraste e bordas padrão do Radix, não transmitindo a identidade profunda e analógica do Instituto LIZ.

---

## C. Arquitetura Proposta
Mudaremos de uma estrutura puramente orientada a rotas para uma arquitetura de domínios (Feature Slices).

```
src/
  features/
    links/
      api/              # Funções explícitas de acesso ao banco (queries/mutations)
        getLinks.ts
        createLink.ts
        deleteLink.ts
      hooks/            # Wrappers do React Query (useLinks, useCreateLink)
      components/       # Componentes exclusivos do domínio (LinkCard, LinkForm)
      types/            # Tipos de domínio e schemas Zod
```
*Não utilizaremos abstrações genéricas (`BaseRepository`). Cada operação será tipada individualmente conectando as queries do Supabase aos Hooks.*

---

## D. Arquivos Afetados

| Arquivo | Motivo da Alteração | Natureza | Risco | Testes Necessários |
|---------|---------------------|----------|-------|--------------------|
| `src/routes/_authenticated/links.tsx` | Desacoplar UI da lógica de dados e aplicar novos tokens visuais | Refatoração estrutural e visual | Baixo | Teste funcional manual e checagem de tipos |
| `src/features/links/api/*.ts` (Novos) | Centralizar `supabase.from('links')` | Criação de Infraestrutura | Baixo | Typecheck estrito contra `Database` types |
| `src/features/links/hooks/*.ts` (Novos)| Centralizar `useQuery/useMutation` | Criação de Infraestrutura | Baixo | Integração do cache (`invalidateQueries`) |
| `src/styles.css` | Mudar paleta corporativa para "Biblioteca Histórica" (papel, sépia sutil, tipografia serifa) | Modificação de CSS Global | Médio (Afeta outras telas indiretamente) | Teste visual (Smoke test) no Dashboard e CRM |
| `tailwind.config.ts` (ou config inline v4) | Adicionar fonte serifada (`Newsreader` ou similar) | Configuração | Baixo | Linting CSS |

---

## E. Sequência de Implementação

A execução ocorrerá em blocos separados para revisão contínua.

### Trilha A — Arquitetura de Dados
1. **Infraestrutura**: Criação da pasta `src/features/links/` com seus subdiretórios `api/`, `hooks/`, `types/`.
2. **Migração**: Extração das queries e mutations de `links.tsx` para os novos arquivos explícitos de API.
3. **Validação A**: Substituição no `links.tsx` para usar os novos hooks customizados. Verificação de typecheck e build.

### Trilha B — Design System
1. **Tokens Fundamentais**: Atualização de `styles.css` para substituir a paleta "Roxo Elétrico/Branco Gélido" por "Sépia/Branco Osso/Roxo Profundo". Adição de fontes ao projeto.
2. **Tela-Piloto (Links)**: Aplicação de classes semânticas e componentes atualizados no `links.tsx` (sombras suaves orgânicas, fundos texturizados, tipografia hierárquica).
3. **Validação B**: Smoke test manual para garantir que outras telas não quebraram e que a tela-piloto reflete a estética LIZ.

---

## F. Domínios-piloto
- **Trilha A (Arquitetura)**: Domínio `Links` (Tabelas `links` e `link_categories`). Baixo impacto relacional, não transacional.
- **Trilha B (Design)**: Rota `/links`. Contém botões, cartões simples, separações estruturais. Permite validar a "aparência de catálogo" de forma isolada.

---

## G. Critérios de Aceite
- [ ] O arquivo `links.tsx` não contém importações de `@supabase/supabase-js` nem chamadas diretas a `supabase.from()`.
- [ ] Todas as mutações no domínio `links` invalidam o cache do React Query corretamente, garantindo atualização em tempo real na tela.
- [ ] O comando `bun run build` ou `npm run build` passa sem erros de tipagem (`tsc`).
- [ ] A paleta do LIZ HUB perdeu a aparência "SaaS corporativo" para um tema mais morno e acolhedor, testável através da rota `/links`.
- [ ] O carregamento, deleção e inserção de links preservam os estados de erro, "loading" explícito e "vazio" sem *waterfalls* ou quebras visuais.
- [ ] Nenhuma alteração foi realizada no contrato de dados (nenhuma migração SQL rodada).

---

## H. Estratégia de Testes
No ambiente atual:
1. **Typecheck & Linting**: Validação forte usando TypeScript e ESLint contra as interfaces exportadas da base de dados Supabase (`npm run lint`).
2. **Integração (React Query)**: Validação manual dos estados (Loading -> Success/Error -> Cache Invalidation) ao criar e deletar links.
3. **Smoke Tests Visuais**: Revisão manual nas telas `dashboard.tsx` e `crm.tsx` para garantir que a mudança global do `styles.css` não prejudicou o contraste, leitura ou botões nessas áreas.

---

## I. Rollback
- **Lote A (Dados)**: Caso o desacoplamento falhe em build, basta dar `git checkout src/routes/_authenticated/links.tsx` retornando as chamadas originais e apagar `src/features/links/`. O risco de banco de dados é zero (sem DDLs/DMLs diretos).
- **Lote B (Design)**: Caso a estética falhe nos testes de acessibilidade ou legibilidade, reverte-se o `styles.css` com as cores antigas e volta-se o `links.tsx` para as antigas classes Tailwind.

---

## J. Commits
Para evitar poluição do histórico de versão e permitir reversão cirúrgica:

1. `refactor(links): extracao do dominio links para feature slices (api e hooks)`
2. `refactor(links): integracao da UI de links com a nova camada de features`
3. `chore(styles): adicao de variaveis CSS e fontes para tema Biblioteca LIZ`
4. `design(links): aplicacao da nova identidade visual na tela de links`
