export const ASSET_TYPES = [
  'document',
  'image',
  'video',
  'audio',
  'archive',
  'link',
  'dataset',
  'other'
] as const;

export type AssetType = typeof ASSET_TYPES[number];

export const ASSET_CATEGORIES = [
  'cover',
  'back_cover',
  'manuscript',
  'interior_pdf',
  'ebook',
  'epub',
  'audiobook',
  'chapter',
  'summary',
  'slide_deck',
  'worksheet',
  'exercise',
  'certificate_template',
  'video_lesson',
  'promotional_video',
  'audio_lesson',
  'landing_page',
  'checkout',
  'registration_page',
  'sales_page',
  'support_material',
  'bibliography',
  'gallery',
  'logo',
  'press_kit',
  'contract',
  'external_reference',
  'document',
  'identity',
  'schedule'
] as const;

export type AssetCategory = typeof ASSET_CATEGORIES[number];

export const STORAGE_PROVIDERS = [
  'supabase',
  'google_drive',
  'hotmart',
  'youtube',
  'vimeo',
  'external_url',
  'repository'
] as const;

export type StorageProvider = typeof STORAGE_PROVIDERS[number];

export const RIGHTS_STATUSES = [
  'owned',
  'licensed',
  'authorized',
  'public_domain',
  'external_reference',
  'unknown',
  'restricted'
] as const;

export type RightsStatus = typeof RIGHTS_STATUSES[number];

export const VISIBILITIES = [
  'public',
  'internal',
  'restricted',
  'private'
] as const;

export type Visibility = typeof VISIBILITIES[number];

export const ASSET_STATUSES = [
  'draft',
  'in_review',
  'approved',
  'archived',
  'unavailable'
] as const;

export type AssetStatus = typeof ASSET_STATUSES[number];

// Mapeamento de quais categorias de assets são válidas para cada tipo de nó
export const NODE_CATEGORY_MAPPING: Record<string, AssetCategory[]> = {
  book: ['cover', 'back_cover', 'manuscript', 'interior_pdf', 'ebook', 'epub', 'audiobook', 'chapter', 'summary', 'landing_page', 'checkout', 'sales_page', 'external_reference', 'support_material'],
  course: ['cover', 'identity', 'landing_page', 'checkout', 'slide_deck', 'worksheet', 'video_lesson', 'certificate_template', 'bibliography', 'support_material', 'external_reference', 'promotional_video', 'sales_page'],
  event: ['cover', 'landing_page', 'registration_page', 'schedule', 'gallery', 'certificate_template', 'promotional_video', 'external_reference', 'support_material', 'checkout'],
  product: ['cover', 'landing_page', 'checkout', 'sales_page', 'promotional_video', 'support_material', 'external_reference', 'gallery'],
  person: ['cover', 'gallery', 'external_reference', 'press_kit'],
  author: ['cover', 'gallery', 'external_reference', 'press_kit'],
  concept: ['summary', 'external_reference', 'bibliography', 'slide_deck', 'video_lesson', 'audio_lesson', 'support_material'], 
  page: ['cover', 'summary', 'external_reference', 'bibliography', 'slide_deck', 'video_lesson', 'audio_lesson', 'support_material', 'gallery'],
  faq: ['external_reference', 'support_material'],
  prompt: ['external_reference', 'support_material'],
  institutional: ['logo', 'cover', 'gallery', 'press_kit', 'external_reference', 'document', 'contract'],
  methodological: ['interior_pdf', 'worksheet', 'exercise', 'slide_deck', 'video_lesson', 'external_reference', 'support_material'],
  educational: ['slide_deck', 'worksheet', 'exercise', 'video_lesson', 'audio_lesson', 'support_material', 'bibliography', 'certificate_template', 'external_reference'],
  bibliographic: ['cover', 'interior_pdf', 'epub', 'summary', 'external_reference', 'bibliography'],
  commercial: ['landing_page', 'checkout', 'sales_page', 'promotional_video', 'gallery', 'contract', 'external_reference'],
  operational: ['document', 'worksheet', 'support_material', 'external_reference'],
  technical: ['document', 'support_material', 'external_reference'],
  legal: ['contract', 'document', 'external_reference'],
  clinical_reference: ['interior_pdf', 'worksheet', 'support_material', 'external_reference', 'bibliography']
};

export function isValidCategoryForNode(nodeType: string, category: string): boolean {
  const allowed = NODE_CATEGORY_MAPPING[nodeType];
  if (!allowed) return false;
  return allowed.includes(category as AssetCategory);
}
