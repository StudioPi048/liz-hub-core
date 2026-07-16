-- Seed validated HUB LIZ links without duplicating existing URLs.

INSERT INTO public.link_categories (name, color, sort_order)
VALUES
  ('Hotmart', '#f97316', 10),
  ('Amazon', '#f59e0b', 20),
  ('Formulários', '#3b82f6', 30),
  ('WhatsApp', '#22c55e', 40),
  ('Plataformas LIZ', '#7c3aed', 50)
ON CONFLICT (name) DO UPDATE SET
  color = EXCLUDED.color,
  sort_order = EXCLUDED.sort_order;

WITH validated_links (category_name, name, url, notes) AS (
  VALUES
    ('Amazon', 'Código Sagrado dos Dentes - Amazon Internacional', 'https://www.amazon.com/dp/6597601300', 'Livro com entrega internacional pela Amazon.'),
    ('Hotmart', 'Monte sua Árvore Comigo - Mapa do Tesouro', 'https://go.hotmart.com/Q104946299G?dp=1', NULL),
    ('Hotmart', 'Clube do Livro', 'https://go.hotmart.com/H101221528D?dp=1', 'Cupom do clube: CLUBEDOLIVRO_VIP.'),
    ('Hotmart', 'Formação Psicogenealogia', 'https://go.hotmart.com/M97794640R?dp=1', NULL),
    ('Hotmart', 'Formação Psicogenealogia para Consteladores', 'https://go.hotmart.com/D105097743K?dp=1', NULL),
    ('Hotmart', 'Curso de Nomes Básico', 'https://go.hotmart.com/U97568259S?dp=1', NULL),
    ('Hotmart', 'Livro A Vida Colorido', 'https://go.hotmart.com/D97168130X?dp=1', NULL),
    ('Hotmart', 'Raízes do Nome', 'https://go.hotmart.com/V97663066Y?dp=1', NULL),
    ('Hotmart', 'Livro Projeto Sentido', 'https://go.hotmart.com/N97168080L?dp=1', NULL),
    ('Hotmart', 'Manual da Psicogenealogia', 'https://go.hotmart.com/F101419556L?dp=1', NULL),
    ('Hotmart', 'Livro O Caminho é Individual, a Caminhada é Coletiva', 'https://go.hotmart.com/V101419597E?dp=1', NULL),
    ('Hotmart', 'Livro Tecendo a Vida para Nossa Criança', 'https://go.hotmart.com/V97168109Y?dp=1', NULL),
    ('Formulários', 'Do Passado ao Presente - Felgueiras - Portugal', 'https://forms.gle/EWG3x2wFsMmQNhqr9', NULL),
    ('Formulários', 'Formulário Google', 'https://docs.google.com/forms/d/e/1FAIpQLScdmVpiTUzPlyze2QGk8Cf2fkNcWjErJZCxQ-tKayYRUbwWJQ/viewform?usp=dialog', NULL),
    ('WhatsApp', 'Grupo Sala de Visitas WPP', 'https://chat.whatsapp.com/J2xsMF9nqQTBKw1pc28uxG', NULL),
    ('Plataformas LIZ', 'Link de todos os produtos', 'https://institutoliz.lovable.app', NULL),
    ('Hotmart', 'Hotmart - X106406130U (revisar nome)', 'https://go.hotmart.com/X106406130U?dp=1', 'Link recebido sem nome confirmado.'),
    ('Hotmart', 'Hotmart - J106631646M (revisar nome)', 'https://go.hotmart.com/J106631646M?dp=1', 'Link recebido sem nome confirmado.')
)
INSERT INTO public.links (category_id, name, url, notes)
SELECT c.id, v.name, v.url, v.notes
FROM validated_links v
JOIN public.link_categories c ON c.name = v.category_name
WHERE NOT EXISTS (
  SELECT 1
  FROM public.links existing
  WHERE existing.url = v.url
);
