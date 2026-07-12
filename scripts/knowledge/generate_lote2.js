const fs = require('fs');
const path = require('path');

const nodes = [
  {
    title: 'Projeto Sentido',
    slug: 'projeto-sentido',
    folder: 'psicogenealogia',
    relations: [
      { type: 'belongs_to', target: 'liz-psicogenealogia' },
      { type: 'used_in', target: 'liz-curso-formacao-completa' },
      { type: 'related_to', target: 'liz-conceito-gisant' },
      { type: 'related_to', target: 'projeto-nome' }
    ]
  },
  { title: 'Lealdades Invisíveis', slug: 'lealdades-invisiveis', folder: 'psicogenealogia', relations: [{ type: 'belongs_to', target: 'liz-psicogenealogia' }] },
  { title: 'Genossociograma', slug: 'genossociograma', folder: 'psicogenealogia', relations: [{ type: 'belongs_to', target: 'liz-psicogenealogia' }] },
  { title: 'Fantasma', slug: 'fantasma', folder: 'psicogenealogia', relations: [{ type: 'belongs_to', target: 'liz-psicogenealogia' }, { type: 'related_to', target: 'cripta' }] },
  { title: 'Cripta', slug: 'cripta', folder: 'psicogenealogia', relations: [{ type: 'belongs_to', target: 'liz-psicogenealogia' }] },
  { title: 'Projeto Nome', slug: 'projeto-nome', folder: 'psicogenealogia', relations: [{ type: 'belongs_to', target: 'liz-psicogenealogia' }] },
  { title: 'Síndrome do Aniversário', slug: 'sindrome-do-aniversario', folder: 'psicogenealogia', relations: [{ type: 'belongs_to', target: 'liz-psicogenealogia' }] },
  { title: 'Parentificação', slug: 'parentificacao', folder: 'psicogenealogia', relations: [{ type: 'belongs_to', target: 'liz-psicogenealogia' }] },
  { title: 'Duplo', slug: 'duplo', folder: 'psicogenealogia', relations: [{ type: 'belongs_to', target: 'liz-psicogenealogia' }] },
  { title: 'Gisant', slug: 'liz-conceito-gisant', folder: 'psicogenealogia', relations: [{ type: 'belongs_to', target: 'liz-psicogenealogia' }] },
  { title: 'Psicogenealogia', slug: 'liz-psicogenealogia', folder: 'psicogenealogia', relations: [] },
  { title: 'Formação Completa', slug: 'liz-curso-formacao-completa', folder: 'cursos', relations: [] }
];

for (const node of nodes) {
  const content = `---
id: ${node.slug}
title: "${node.title}"
type: page
status: draft
authority_level: working_material
visibility: internal
author: "Instituto LIZ"
relations:
${node.relations.map(r => `  - type: ${r.type}\n    target: ${r.target}`).join('\n')}
---
# ${node.title}

*Conteúdo em elaboração. Este nó foi criado para estabelecer a ontologia estrutural do Patrimônio Intelectual do LIZ HUB.*

## Quem criou?
Instituto LIZ

## O que é?
Conceito fundamental em estruturação.

## Para que serve?
TBD.

## Onde é utilizado?
TBD.
`;

  fs.writeFileSync(path.join(__dirname, '..', '..', 'knowledge', node.folder, `${node.slug}.md`), content);
}
console.log('Nodes generated.');
