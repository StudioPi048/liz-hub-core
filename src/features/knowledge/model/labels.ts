import type { AssetCategory, AssetStatus, Visibility } from "./asset-vocabulary";

export const NODE_STATUS_LABEL: Record<string, string> = {
  draft: "Rascunho",
  in_review: "Em revisão",
  approved: "Aprovado",
  rejected: "Rejeitado",
};

export const AUTHORITY_LABEL: Record<string, string> = {
  official: "Oficial",
  unverified: "Não verificado",
};

export const ASSET_STATUS_LABEL: Record<AssetStatus, string> = {
  draft: "Rascunho",
  in_review: "Em revisão",
  approved: "Aprovado",
  archived: "Arquivado",
  unavailable: "Indisponível",
};

export const VISIBILITY_LABEL: Record<Visibility, string> = {
  public: "Público",
  internal: "Interno",
  restricted: "Restrito",
  private: "Privado",
};

export const ASSET_CATEGORY_LABEL: Record<AssetCategory, string> = {
  cover: "Capa",
  back_cover: "Contracapa",
  manuscript: "Manuscrito",
  interior_pdf: "PDF do miolo",
  ebook: "E-book",
  epub: "EPUB",
  audiobook: "Audiobook",
  chapter: "Capítulo",
  summary: "Resumo",
  slide_deck: "Slides",
  worksheet: "Apostila",
  exercise: "Exercício",
  certificate_template: "Modelo de certificado",
  video_lesson: "Aula em vídeo",
  promotional_video: "Vídeo promocional",
  audio_lesson: "Aula em áudio",
  landing_page: "Página de vendas (landing page)",
  checkout: "Checkout",
  registration_page: "Página de inscrição",
  sales_page: "Página de vendas",
  support_material: "Material de apoio",
  bibliography: "Bibliografia",
  gallery: "Galeria de fotos",
  logo: "Logo",
  press_kit: "Kit de imprensa",
  contract: "Contrato",
  external_reference: "Referência externa",
  document: "Documento",
  identity: "Identidade visual",
  schedule: "Cronograma",
};
