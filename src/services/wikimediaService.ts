/**
 * Wikimedia Commons Action API Client & Service
 * Official API documentation: https://commons.wikimedia.org/w/api.php
 */

export interface WikimediaImage {
  id: string
  pageId: number
  title: string
  cleanTitle: string
  thumbUrl: string
  thumbWidth?: number
  thumbHeight?: number
  originalUrl: string
  descriptionUrl: string
  mime: string
  width: number
  height: number
  sizeBytes: number
  formattedSize: string
  license: string
  licenseUrl?: string
  artist: string
  credit?: string
  description: string
  date?: string
}

export interface RawWikimediaPage {
  pageid?: number
  ns?: number
  title?: string
  index?: number
  fullurl?: string
  imageinfo?: Array<{
    url?: string
    thumburl?: string
    thumbwidth?: number
    thumbheight?: number
    width?: number
    height?: number
    size?: number
    mime?: string
    descriptionurl?: string
    extmetadata?: {
      Artist?: { value?: string }
      Credit?: { value?: string }
      LicenseShortName?: { value?: string }
      UsageTerms?: { value?: string }
      License?: { value?: string }
      LicenseUrl?: { value?: string }
      ImageDescription?: { value?: string }
      ObjectName?: { value?: string }
      DateTime?: { value?: string }
      DateTimeOriginal?: { value?: string }
    }
  }>
}

export interface WikimediaSearchResult {
  query: string
  images: WikimediaImage[]
  continueParams: Record<string, string> | null
}

const WIKIMEDIA_COMMONS_API = 'https://commons.wikimedia.org/w/api.php'

/**
 * Strips HTML tags and decodes common HTML entities from metadata strings
 */
export function stripHtml(input: string | undefined | null): string {
  if (!input) return ''
  return input
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/p>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&minus;/g, '−')
    .replace(/&copy;/g, '©')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Formats byte size into human-readable notation
 */
export function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0 || isNaN(bytes)) return 'Unknown size'
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)))
  const formatted = (bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)
  return `${formatted} ${units[i]}`
}

/**
 * Normalizes Wikimedia file titles into human-friendly names
 */
export function formatFileTitle(title: string): string {
  if (!title) return 'Untitled'
  return title
    .replace(/^File:/i, '')
    .replace(/\.[a-zA-Z0-9]{3,4}$/, '')
    .replace(/_/g, ' ')
    .trim() || 'Untitled'
}

/**
 * Determines whether a file entry is a supported renderable image
 */
export function isImageFile(mime?: string, title?: string, thumbUrl?: string): boolean {
  if (!thumbUrl) return false
  if (mime) {
    if (mime.startsWith('image/')) return true
    if (mime.includes('audio') || mime.includes('video') || mime.includes('pdf')) return false
  }
  if (title) {
    return /\.(jpe?g|png|webp|gif|svg|avif|bmp|tiff?)$/i.test(title)
  }
  return true
}

/**
 * Extracts and maps raw Wikimedia API page data into a clean WikimediaImage object
 */
export function transformWikimediaPage(page: RawWikimediaPage): WikimediaImage | null {
  if (!page || !page.imageinfo || !page.imageinfo.length) return null

  const info = page.imageinfo[0]
  const title = page.title || ''
  const mime = info.mime || ''
  const thumbUrl = info.thumburl || info.url || ''

  if (!isImageFile(mime, title, thumbUrl)) {
    return null
  }

  const meta = info.extmetadata || {}

  const rawArtist = meta.Artist?.value || meta.Credit?.value || ''
  const artist = stripHtml(rawArtist) || 'Not specified'

  const rawLicense = meta.LicenseShortName?.value || meta.UsageTerms?.value || meta.License?.value || ''
  const license = stripHtml(rawLicense) || 'See Wikimedia page for license'

  const rawLicenseUrl = meta.LicenseUrl?.value
  const licenseUrl = typeof rawLicenseUrl === 'string' && rawLicenseUrl.startsWith('http')
    ? rawLicenseUrl
    : undefined

  const rawDescription = meta.ImageDescription?.value || meta.ObjectName?.value || ''
  const description = stripHtml(rawDescription)

  const rawDate = meta.DateTimeOriginal?.value || meta.DateTime?.value || ''
  const date = stripHtml(rawDate)

  const rawCredit = meta.Credit?.value
  const credit = rawCredit ? stripHtml(rawCredit) : undefined

  const width = Number(info.width) || 0
  const height = Number(info.height) || 0
  const sizeBytes = Number(info.size) || 0

  return {
    id: String(page.pageid || page.title),
    pageId: Number(page.pageid) || 0,
    title: page.title || '',
    cleanTitle: formatFileTitle(page.title || ''),
    thumbUrl,
    thumbWidth: Number(info.thumbwidth) || undefined,
    thumbHeight: Number(info.thumbheight) || undefined,
    originalUrl: info.url || thumbUrl,
    descriptionUrl: info.descriptionurl || page.fullurl || `https://commons.wikimedia.org/wiki/${encodeURIComponent(page.title || '')}`,
    mime: mime || 'image/jpeg',
    width,
    height,
    sizeBytes,
    formattedSize: formatBytes(sizeBytes),
    license,
    licenseUrl,
    artist,
    credit,
    description,
    date: date || undefined,
  }
}

/**
 * Searches Wikimedia Commons for images matching a user query
 */
export async function searchWikimediaImages(
  query: string,
  continueParams: Record<string, string> | null = null,
  signal?: AbortSignal
): Promise<WikimediaSearchResult> {
  const trimmed = query.trim()
  if (!trimmed) {
    return { query: '', images: [], continueParams: null }
  }

  const params: Record<string, string> = {
    action: 'query',
    format: 'json',
    origin: '*',
    generator: 'search',
    gsrsearch: trimmed,
    gsrnamespace: '6', // File namespace
    gsrlimit: '24', // Results per page
    prop: 'imageinfo|info',
    inprop: 'url',
    iiprop: 'url|size|mime|extmetadata',
    iiurlwidth: '640', // Crisp responsive thumbnail
  }

  if (continueParams) {
    Object.assign(params, continueParams)
  }

  const url = new URL(WIKIMEDIA_COMMONS_API)
  url.search = new URLSearchParams(params).toString()

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
    signal,
  })

  if (!response.ok) {
    throw new Error(`Wikimedia Commons API error: ${response.status} ${response.statusText}`)
  }

  const data = await response.json()

  if (data.error) {
    throw new Error(`Wikimedia Commons API: ${data.error.info || data.error.code || 'Unknown error'}`)
  }

  const rawPages = (data.query?.pages ? Object.values(data.query.pages) : []) as RawWikimediaPage[]

  // Sort by generator search relevance index if provided
  rawPages.sort((a: RawWikimediaPage, b: RawWikimediaPage) => (Number(a.index) || 0) - (Number(b.index) || 0))

  const images: WikimediaImage[] = []
  for (const page of rawPages) {
    const item = transformWikimediaPage(page)
    if (item) {
      images.push(item)
    }
  }

  const nextContinue = data.continue ? { ...data.continue } : null

  return {
    query: trimmed,
    images,
    continueParams: nextContinue,
  }
}

/**
 * Downloads a Wikimedia image locally using fetch blob with fallback to direct link
 */
export async function downloadWikimediaImage(imageUrl: string, filename: string): Promise<boolean> {
  try {
    const response = await fetch(imageUrl, { mode: 'cors' })
    if (!response.ok) throw new Error('Fetch failed')
    const blob = await response.blob()
    const objectUrl = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = objectUrl
    link.download = filename
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 2000)
    return true
  } catch {
    // Fallback: trigger browser download or open in new tab
    const link = document.createElement('a')
    link.href = imageUrl
    link.download = filename
    link.target = '_blank'
    link.rel = 'noopener noreferrer'
    document.body.appendChild(link)
    link.click()
    link.remove()
    return true
  }
}
