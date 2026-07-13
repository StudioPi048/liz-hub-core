const fs = require('fs');
const path = require('path');

const baseDir = './knowledge';

const files = [
  { dir: 'cursos', id: 'liz-curso-formacao-psicogenealogia', title: 'Formação em Psicogenealogia', slug: 'formacao-psicogenealogia', type: 'course', assets: [{ id: 'checkout', type: 'link', category: 'checkout', path: 'https://go.hotmart.com/M97794640R?dp=1', provider: 'external', title: 'Checkout Hotmart' }] },
  { dir: 'cursos', id: 'liz-curso-formacao-consteladores', title: 'Formação em Psicogenealogia para Consteladores', slug: 'formacao-consteladores', type: 'course', assets: [{ id: 'checkout', type: 'link', category: 'checkout', path: 'https://go.hotmart.com/D105097743K?dp=1', provider: 'external', title: 'Checkout Hotmart' }] },
  { dir: 'cursos', id: 'liz-curso-nomes-basico', title: 'Curso de Nomes (Básico)', slug: 'curso-nomes-basico', type: 'course', assets: [{ id: 'checkout', type: 'link', category: 'checkout', path: 'https://go.hotmart.com/U97568259S?dp=1', provider: 'external', title: 'Checkout Hotmart' }] },
  { dir: 'eventos', id: 'liz-vivencia-mapa-tesouro', title: 'Monte sua Árvore Comigo – Mapa do Tesouro', slug: 'mapa-tesouro', type: 'event', assets: [{ id: 'checkout', type: 'link', category: 'checkout', path: 'https://go.hotmart.com/Q104946299G?dp=1', provider: 'external', title: 'Checkout Hotmart' }] },
  { dir: 'eventos', id: 'liz-evento-passado-presente', title: 'Do Passado ao Presente (Portugal)', slug: 'evento-passado-presente', type: 'event', assets: [{ id: 'form', type: 'link', category: 'page', path: 'https://forms.gle/EWG3x2wFsMmQNhqr9', provider: 'external', title: 'Formulário de Inscrição' }] },
  { dir: 'livros', id: 'liz-livro-codigo-sagrado-dentes', title: 'Código Sagrado dos Dentes', slug: 'codigo-sagrado-dentes', type: 'book', assets: [{ id: 'amazon', type: 'link', category: 'page', path: 'https://www.amazon.com/dp/6597601300', provider: 'external', title: 'Amazon Internacional' }] },
  { dir: 'livros', id: 'liz-livro-manual-psicogenealogia', title: 'Manual da Psicogenealogia', slug: 'manual-psicogenealogia', type: 'book', assets: [{ id: 'checkout', type: 'link', category: 'checkout', path: 'https://go.hotmart.com/F101419556L?dp=1', provider: 'external', title: 'Checkout Hotmart' }] },
  { dir: 'livros', id: 'liz-livro-projeto-sentido', title: 'Projeto Sentido', slug: 'projeto-sentido', type: 'book', assets: [{ id: 'checkout', type: 'link', category: 'checkout', path: 'https://go.hotmart.com/N97168080L?dp=1', provider: 'external', title: 'Checkout Hotmart' }] },
  { dir: 'livros', id: 'liz-livro-raizes-do-nome', title: 'Raízes do Nome', slug: 'raizes-do-nome', type: 'book', assets: [{ id: 'checkout', type: 'link', category: 'checkout', path: 'https://go.hotmart.com/V97663066Y?dp=1', provider: 'external', title: 'Checkout Hotmart' }] },
  { dir: 'livros', id: 'liz-livro-tecendo-vida-crianca', title: 'Tecendo a Vida para Nossa Criança', slug: 'tecendo-vida-crianca', type: 'book', assets: [{ id: 'checkout', type: 'link', category: 'checkout', path: 'https://go.hotmart.com/V97168109Y?dp=1', provider: 'external', title: 'Checkout Hotmart' }] },
  { dir: 'livros', id: 'liz-livro-caminho-individual', title: 'O Caminho é Individual, a Caminhada é Coletiva', slug: 'caminho-individual', type: 'book', assets: [{ id: 'checkout', type: 'link', category: 'checkout', path: 'https://go.hotmart.com/V101419597E?dp=1', provider: 'external', title: 'Checkout Hotmart' }] },
  { dir: 'livros', id: 'liz-livro-a-vida-colorido', title: 'A Vida (Colorido)', slug: 'a-vida-colorido', type: 'book', assets: [{ id: 'checkout', type: 'link', category: 'checkout', path: 'https://go.hotmart.com/D97168130X?dp=1', provider: 'external', title: 'Checkout Hotmart' }] },
  { dir: 'produtos', id: 'liz-produto-clube-do-livro', title: 'Clube do Livro', slug: 'clube-do-livro', type: 'product', assets: [{ id: 'checkout', type: 'link', category: 'checkout', path: 'https://go.hotmart.com/H101221528D?dp=1', provider: 'external', title: 'Checkout Hotmart' }] },
  { dir: 'produtos', id: 'liz-hotmart-link-1', title: 'Produto Desconhecido 1 (Revisar)', slug: 'hotmart-link-1', type: 'product', assets: [{ id: 'checkout', type: 'link', category: 'checkout', path: 'https://go.hotmart.com/X106406130U?dp=1', provider: 'external', title: 'Checkout Hotmart' }] },
  { dir: 'produtos', id: 'liz-hotmart-link-2', title: 'Produto Desconhecido 2 (Revisar)', slug: 'hotmart-link-2', type: 'product', assets: [{ id: 'checkout', type: 'link', category: 'checkout', path: 'https://go.hotmart.com/J106631646M?dp=1', provider: 'external', title: 'Checkout Hotmart' }] }
];

files.forEach(f => {
  const dirPath = path.join(baseDir, f.dir);
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
  let assetsYaml = '';
  if (f.assets) {
    assetsYaml = 'assets:\n' + f.assets.map(a => `  - id: ${a.id}\n    type: ${a.type}\n    category: ${a.category}\n    path: "${a.path}"\n    provider: ${a.provider}\n    title: "${a.title}"`).join('\n') + '\n';
  }
  const content = `---\nid: ${f.id}\ntitle: "${f.title}"\nslug: ${f.slug}\ntype: ${f.type}\nstatus: approved\nauthority_level: official\nvisibility: public\nauthor: "Instituto LIZ"\nlanguage: pt-BR\n${assetsYaml}---\n# ${f.title}\n\n*Registro oficial do patrimônio intelectual do Instituto LIZ.*\n\n## Quem criou?\nInstituto LIZ\n`;
  fs.writeFileSync(path.join(dirPath, `${f.id}.md`), content);
});

console.log(`Generated ${files.length} files.`);
