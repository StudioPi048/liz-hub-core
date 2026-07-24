-- Seed idempotente dos formulários 2026 na Biblioteca de Links.
-- Categoria visual: Formulários.

WITH category AS (
  INSERT INTO public.link_categories (name, color, sort_order)
  VALUES ('Formulários', '#2563eb', 10)
  ON CONFLICT (name) DO UPDATE
  SET color = EXCLUDED.color,
      sort_order = EXCLUDED.sort_order
  RETURNING id
),
forms (name, url, notes) AS (
  VALUES
    ('DECODIFICAÇÃO DE NOMES', 'https://docs.google.com/forms/d/11VimvPUX6ZKUwPkQ7Git_vpR5WqnABNYJuoTJ8b_0dw/viewform', '#2026 #formulario #google-forms #decodificacao #nomes'),
    ('segundo lote O CÓDIGO SAGRADO DOS DENTES', 'https://docs.google.com/forms/d/1Jo3TLST_9AeDUVUN9ODtX1t9Gje-K08-0VJmsAT9LiM/viewform', '#2026 #formulario #google-forms #segundo-lote #codigo-sagrado-dentes'),
    ('O CÓDIGO SAGRADO DOS DENTES', 'https://docs.google.com/forms/d/1lUkk7RzVIaLSeHuXQb03M0XAI3V-8y1IzFEl6WoMc-8/viewform', '#2026 #formulario #google-forms #codigo-sagrado-dentes'),
    ('QUERO TE CONHECER - TURMAS CABALÁ 2026', 'https://docs.google.com/forms/d/1_eE92XoX2eNYtH4F8kuKXmyt-yBXmaHWElbOcrv38tg/viewform', '#2026 #formulario #google-forms #cabala #turmas'),
    ('DECODIFICAÇÃO DENTAL APLICADA ÁS CONSTELAÇÕES FAMILIARES', 'https://docs.google.com/forms/d/1bdmArOT-YZrQ_wy2mrl3zjYQ18iXoa32H91Ad4ZOvu4/viewform', '#2026 #formulario #google-forms #decodificacao-dental #constelacoes'),
    ('PRIMEIROS PASSOS (FILIPA)', 'https://docs.google.com/forms/d/17QLS3SYuyDau4Hfxs6e9jVVHJCu5r2z67Clb7eXW0ks/viewform', '#2026 #formulario #google-forms #primeiros-passos #filipa'),
    ('PSICOGENEALOGISTA MENTORADO #LIZ INDICA', 'https://docs.google.com/forms/d/17sfTG_CQbt_AQ1RLTKJDdh3v8eLD-h6Fj4ET6M0CCJ8/viewform', '#2026 #formulario #google-forms #liz-indica #mentorado'),
    ('FORMAÇÃO PSICOGENEALOGIA -ON LINE 2026', 'https://docs.google.com/forms/d/14EDuWo2j7S9HIepsZP-c-9lvRbBB6nQW-2LxAKcYqr8/viewform', '#2026 #formulario #google-forms #formacao #psicogenealogia #online'),
    ('PSICOGENEALOGIA APLICADA PARA CONSTELADORES', 'https://docs.google.com/forms/d/1b-QRphXo_pDYUYLactpwhcAZMmSi86PvNzF50nNRVto/viewform', '#2026 #formulario #google-forms #psicogenealogia #consteladores'),
    ('PRIMEIROS PASSOS (MARTA)', 'https://docs.google.com/forms/d/18gct_LVJq7vHV4X8DfLS5LVb6pXBunY9mDyoZleapFU/viewform', '#2026 #formulario #google-forms #primeiros-passos #marta'),
    ('DECODIFICAÇÃO BIOLÓGICA TRANSGERACIONA', 'https://docs.google.com/forms/d/1HEwrH-4gf5x-utpunS0MmR42QCWaKbOG0xQ66XQya_U/viewform', '#2026 #formulario #google-forms #decodificacao-biologica #transgeracional'),
    ('EXPERIÊNCIA EXECUTIVA', 'https://docs.google.com/forms/d/1q77Wa2cG6VsnCRgmpIGy4rlaNeIoEy9mOHdJZysrpWI/viewform', '#2026 #formulario #google-forms #experiencia-executiva'),
    ('Informações de contato', 'https://docs.google.com/forms/d/1yX9O19TBYdqrHDOxMryuqgBmqWQQ6y3UVNtn0av2g6I/viewform', '#2026 #formulario #google-forms #contato'),
    ('DO PASSADO AO PRESENTE Um olhar da Psicogenealogia ampliado, para o ser humano e suas relações familiares', 'https://docs.google.com/forms/d/1E-RT8DKfrpCB-xyMqxQ05hqwV_-KgJKp3Wo-EhaXbV0/viewform', '#2026 #formulario #google-forms #passado-presente #psicogenealogia'),
    ('Informações de contato', 'https://docs.google.com/forms/d/1S6W_ojEbzsgBLIWbGnssiWxssNN8m0bOt0e-Uh4RQ_4/viewform', '#2026 #formulario #google-forms #contato'),
    ('WORKSHOP 7 GERAÇÕES', 'https://docs.google.com/forms/d/14RRhNDOydw3WFnfvzUTVzj3oZNEEWtxJsDSj7J2HofI/viewform', '#2026 #formulario #google-forms #workshop #7-geracoes'),
    ('PSICOGENEALOGIA APLICADA PARA CONSTELADORES - TURMA INTERNACIONAL (on line)', 'https://docs.google.com/forms/d/1kdy2gHZuDox8mPG_qeUCeiqIZai9XRPDFO8-CBePvMA/viewform', '#2026 #formulario #google-forms #psicogenealogia #consteladores #internacional #online'),
    ('FORMAÇÃO PSICOGENEALOGIA -ON LINE 2026 - Turma 2', 'https://docs.google.com/forms/d/1REdpV3hOv6wKy_ieUA24Q3NxYeCYbEaqSok4cN6ruvI/viewform', '#2026 #formulario #google-forms #formacao #psicogenealogia #online #turma-2'),
    ('Raízes da Prosperidade - MARTA', 'https://docs.google.com/forms/d/1fI2R7x8V-fdon5cRihf8YilMvsTfbh2KEDoMRF-ty-A/viewform', '#2026 #formulario #google-forms #raizes-prosperidade #marta'),
    ('PSICOGENEALOGIA APLICADA PARA CONSTELADORES - TURMA INTERNACIONAL', 'https://docs.google.com/forms/d/1KFaCuAHHxUAP1smf8J0sczUlQM6KzdJGNaelSq3Z9ZQ/viewform', '#2026 #formulario #google-forms #psicogenealogia #consteladores #internacional'),
    ('Curso Braga - Decodificação Dental aplicada a Psicogenealogia', 'https://docs.google.com/forms/d/1UOLiaGqmLfwwZRq0Ft-RTsSBSr7ZhlrTi_w4w0sTuTI/viewform', '#2026 #formulario #google-forms #braga #decodificacao-dental #psicogenealogia'),
    ('CABALÁ APLICADA A PSICOGENEALOGIA 2026', 'https://docs.google.com/forms/d/1zpx37_9_C6SjoZB3VdkvZYty9F4McNr4TX0W58ZIv0Q/viewform', '#2026 #formulario #google-forms #cabala #psicogenealogia'),
    ('LISBOA PSICOGENEALOGIA APLICADA Á CONSTELADORES', 'https://docs.google.com/forms/d/1dVKPfUpNeRjsZRPP70BTlTUwdAniSoCJZhglYZuF8EM/viewform', '#2026 #formulario #google-forms #lisboa #psicogenealogia #consteladores')
)
INSERT INTO public.links (category_id, name, url, notes)
SELECT category.id, forms.name, forms.url, forms.notes
FROM forms
CROSS JOIN category
WHERE NOT EXISTS (
  SELECT 1
  FROM public.links existing
  WHERE existing.url = forms.url
);
