import React, { useEffect, useRef, useState, type FormEvent } from 'react'
import {
  AlertCircle,
  ArrowDownToLine,
  Check,
  ExternalLink,
  Image as ImageIcon,
  Info,
  Maximize2,
  RotateCw,
  Search,
  Shield,
  User,
  X,
} from 'lucide-react'
import {
  downloadWikimediaImage,
  searchWikimediaImages,
  type WikimediaImage,
} from '../services/wikimediaService'

interface WikimediaImageSearchProps {
  onSelectImage?: (image: WikimediaImage) => void
}

const EXAMPLE_QUERIES = [
  'Elephant',
  'Mountain landscape',
  'Sports car',
  'Purple wallpaper',
]

export const WikimediaImageSearch: React.FC<WikimediaImageSearchProps> = () => {
  const [query, setQuery] = useState('')
  const [activeQuery, setActiveQuery] = useState('')
  const [images, setImages] = useState<WikimediaImage[]>([])
  const [continueParams, setContinueParams] = useState<Record<string, string> | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasSearched, setHasSearched] = useState(false)
  const [selectedImage, setSelectedImage] = useState<WikimediaImage | null>(null)
  const [failedImageIds, setFailedImageIds] = useState<Set<string>>(new Set())
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [downloadSuccessId, setDownloadSuccessId] = useState<string | null>(null)

  const searchInputRef = useRef<HTMLInputElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  const handleSearch = async (searchTerm: string, isNewQuery = true) => {
    const trimmed = searchTerm.trim()
    if (!trimmed) return

    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    const controller = new AbortController()
    abortControllerRef.current = controller

    if (isNewQuery) {
      setIsLoading(true)
      setError(null)
      setHasSearched(true)
      setActiveQuery(trimmed)
      setFailedImageIds(new Set())
    } else {
      setIsLoadingMore(true)
    }

    try {
      const result = await searchWikimediaImages(
        trimmed,
        isNewQuery ? null : continueParams,
        controller.signal
      )

      if (isNewQuery) {
        setImages(result.images)
      } else {
        // Deduplicate incoming images against existing IDs
        setImages((prev) => {
          const existingIds = new Set(prev.map((img) => img.id))
          const newUnique = result.images.filter((img) => !existingIds.has(img.id))
          return [...prev, ...newUnique]
        })
      }
      setContinueParams(result.continueParams)
      setError(null)
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return
      console.error('Wikimedia search error:', err)
      setError(err instanceof Error ? err.message : 'Failed to search Wikimedia Commons. Please check your connection and try again.')
    } finally {
      setIsLoading(false)
      setIsLoadingMore(false)
    }
  }

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    handleSearch(query, true)
  }

  const handleChipClick = (suggestion: string) => {
    setQuery(suggestion)
    handleSearch(suggestion, true)
  }

  const handleRetry = () => {
    if (activeQuery) {
      handleSearch(activeQuery, true)
    } else if (query.trim()) {
      handleSearch(query, true)
    }
  }

  const handleImageError = (id: string) => {
    setFailedImageIds((prev) => new Set(prev).add(id))
  }

  const handleDownload = async (img: WikimediaImage) => {
    setDownloadingId(img.id)
    try {
      const filename = `${img.cleanTitle.replace(/[^a-zA-Z0-9_-]+/g, '_').toLowerCase() || 'wikimedia-image'}.${img.mime.split('/')[1] || 'jpg'}`
      await downloadWikimediaImage(img.originalUrl, filename)
      setDownloadSuccessId(img.id)
      setTimeout(() => setDownloadSuccessId(null), 2500)
    } catch (err) {
      console.error('Download error:', err)
    } finally {
      setDownloadingId(null)
    }
  }

  // Keyboard navigation for detail dialog
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedImage) {
        setSelectedImage(null)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedImage])

  return (
    <div className="wikimedia-studio">
      {/* Search Header Bar */}
      <div className="wikimedia-search-bar-wrap">
        <form className="wikimedia-search-form" onSubmit={handleSubmit} role="search">
          <div className="wikimedia-input-wrap">
            <Search className="wikimedia-search-icon" size={18} aria-hidden="true" />
            <input
              ref={searchInputRef}
              type="search"
              className="wikimedia-search-input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search Wikimedia Commons (e.g. elephant, mountain landscape, sports car...)"
              aria-label="Search images on Wikimedia Commons"
            />
            {query && (
              <button
                type="button"
                className="wikimedia-clear-btn"
                onClick={() => {
                  setQuery('')
                  searchInputRef.current?.focus()
                }}
                aria-label="Clear search input"
              >
                <X size={15} />
              </button>
            )}
          </div>
          <button
            type="submit"
            className="wikimedia-search-btn"
            disabled={!query.trim() || isLoading}
            aria-label="Execute search"
          >
            {isLoading ? <RotateCw className="animate-spin" size={16} /> : <Search size={16} />}
            <span>Search</span>
          </button>
        </form>

        {/* Suggestion Chips */}
        <div className="wikimedia-chips-row" aria-label="Suggested search terms">
          <span className="wikimedia-chips-label">Suggestions:</span>
          {EXAMPLE_QUERIES.map((item) => (
            <button
              key={item}
              type="button"
              className={`wikimedia-chip ${activeQuery.toLowerCase() === item.toLowerCase() ? 'is-active' : ''}`}
              onClick={() => handleChipClick(item)}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="wikimedia-content-scroll" tabIndex={0}>
        {/* Error State */}
        {error && !isLoading && (
          <div className="wikimedia-state-card wikimedia-state-card--error" role="alert">
            <div className="wikimedia-state-icon wikimedia-state-icon--error">
              <AlertCircle size={28} />
            </div>
            <h3>Unable to Load Images</h3>
            <p>{error}</p>
            <button type="button" className="wikimedia-action-btn wikimedia-action-btn--primary" onClick={handleRetry}>
              <RotateCw size={15} />
              <span>Retry Search</span>
            </button>
          </div>
        )}

        {/* Initial / Welcome State */}
        {!hasSearched && !isLoading && !error && (
          <div className="wikimedia-state-card wikimedia-state-card--welcome">
            <div className="wikimedia-state-icon">
              <ImageIcon size={32} />
            </div>
            <h3>Search Wikimedia Commons</h3>
            <p>
              Discover authentic Creative Commons and public domain photographs, historical images,
              and illustrations directly from the Wikimedia Commons repository.
            </p>
            <div className="wikimedia-welcome-examples">
              <span>Try searching for:</span>
              <div className="wikimedia-welcome-chips">
                {EXAMPLE_QUERIES.map((item) => (
                  <button
                    key={item}
                    type="button"
                    className="wikimedia-chip"
                    onClick={() => handleChipClick(item)}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Empty Results State */}
        {hasSearched && !isLoading && !error && images.length === 0 && (
          <div className="wikimedia-state-card wikimedia-state-card--empty">
            <div className="wikimedia-state-icon">
              <Search size={28} />
            </div>
            <h3>No Images Found</h3>
            <p>
              We couldn't find any Wikimedia Commons media matching <strong>"{activeQuery}"</strong>.
            </p>
            <p className="wikimedia-state-sub">
              Try searching with broader terms, alternative keywords, or common nouns (e.g. "astronomy", "architecture", "wildlife").
            </p>
          </div>
        )}

        {/* Skeletons Loading State */}
        {isLoading && (
          <div className="wikimedia-grid" aria-busy="true" aria-label="Loading search results">
            {Array.from({ length: 12 }).map((_, idx) => (
              <div key={`skel-${idx}`} className="wikimedia-card-skeleton">
                <div className="wikimedia-skeleton-thumb" />
                <div className="wikimedia-skeleton-meta">
                  <div className="wikimedia-skeleton-line wikimedia-skeleton-line--long" />
                  <div className="wikimedia-skeleton-line wikimedia-skeleton-line--short" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Results Gallery Grid */}
        {!isLoading && images.length > 0 && (
          <div className="wikimedia-results-wrap">
            <div className="wikimedia-results-bar">
              <span className="wikimedia-results-count">
                Showing <strong>{images.length}</strong> {images.length === 1 ? 'image' : 'images'} for "{activeQuery}"
              </span>
              <span className="wikimedia-results-license-note">
                <Info size={13} className="shrink-0" />
                <span>Media licensed by Wikimedia Commons authors</span>
              </span>
            </div>

            <div className="wikimedia-grid" role="grid" aria-label="Image search results">
              {images.map((img) => {
                const isFailed = failedImageIds.has(img.id)
                return (
                  <div
                    key={img.id}
                    className="wikimedia-card"
                    tabIndex={0}
                    role="gridcell"
                    aria-label={img.cleanTitle}
                    onClick={() => setSelectedImage(img)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        setSelectedImage(img)
                      }
                    }}
                  >
                    <div className="wikimedia-card-media">
                      {isFailed ? (
                        <div className="wikimedia-card-failed">
                          <ImageIcon size={24} className="opacity-40" />
                          <span>Image unavailable</span>
                        </div>
                      ) : (
                        <img
                          src={img.thumbUrl}
                          alt={img.cleanTitle}
                          loading="lazy"
                          decoding="async"
                          onError={() => handleImageError(img.id)}
                          className="wikimedia-card-img"
                        />
                      )}
                      <div className="wikimedia-card-overlay">
                        <span className="wikimedia-card-zoom-badge" aria-hidden="true">
                          <Maximize2 size={13} />
                          <span>Preview</span>
                        </span>
                      </div>
                    </div>
                    <div className="wikimedia-card-info">
                      <strong className="wikimedia-card-title" title={img.cleanTitle}>
                        {img.cleanTitle}
                      </strong>
                      <div className="wikimedia-card-tags">
                        <span className="wikimedia-license-tag" title={`License: ${img.license}`}>
                          {img.license}
                        </span>
                        {img.width > 0 && img.height > 0 && (
                          <span className="wikimedia-dim-tag">
                            {img.width}×{img.height}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Load More Button */}
            {continueParams && (
              <div className="wikimedia-load-more-wrap">
                <button
                  type="button"
                  className="wikimedia-load-more-btn"
                  onClick={() => handleSearch(activeQuery, false)}
                  disabled={isLoadingMore}
                >
                  {isLoadingMore ? (
                    <>
                      <RotateCw className="animate-spin" size={16} />
                      <span>Loading more images...</span>
                    </>
                  ) : (
                    <>
                      <ArrowDownToLine size={16} />
                      <span>Load More Images</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Selected Image Detail Lightbox Modal */}
      {selectedImage && (
        <div
          className="wikimedia-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="wikimedia-preview-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedImage(null)
          }}
        >
          <div className="wikimedia-modal-card">
            <header className="wikimedia-modal-header">
              <div className="wikimedia-modal-title-wrap">
                <h3 id="wikimedia-preview-title" title={selectedImage.cleanTitle}>
                  {selectedImage.cleanTitle}
                </h3>
                <span className="wikimedia-modal-filename" title={selectedImage.title}>
                  {selectedImage.title}
                </span>
              </div>
              <button
                type="button"
                className="wikimedia-modal-close-btn"
                onClick={() => setSelectedImage(null)}
                aria-label="Close preview dialog"
              >
                <X size={18} />
              </button>
            </header>

            <div className="wikimedia-modal-body">
              {/* Image Preview Canvas */}
              <div className="wikimedia-modal-visual">
                <img
                  src={selectedImage.originalUrl || selectedImage.thumbUrl}
                  alt={selectedImage.cleanTitle}
                  className="wikimedia-modal-img"
                />
              </div>

              {/* Metadata Details Sidebar */}
              <div className="wikimedia-modal-details">
                {selectedImage.description && (
                  <div className="wikimedia-detail-group">
                    <span className="wikimedia-detail-label">Description</span>
                    <p className="wikimedia-detail-description">{selectedImage.description}</p>
                  </div>
                )}

                <div className="wikimedia-detail-group">
                  <span className="wikimedia-detail-label">Creator & Attribution</span>
                  <div className="wikimedia-detail-row">
                    <User size={14} className="wikimedia-detail-icon" />
                    <span>{selectedImage.artist}</span>
                  </div>
                  {selectedImage.credit && selectedImage.credit !== selectedImage.artist && (
                    <p className="wikimedia-detail-credit">{selectedImage.credit}</p>
                  )}
                </div>

                <div className="wikimedia-detail-group">
                  <span className="wikimedia-detail-label">License & Usage Terms</span>
                  <div className="wikimedia-detail-row">
                    <Shield size={14} className="wikimedia-detail-icon" />
                    <strong className="text-violet-300 font-medium">{selectedImage.license}</strong>
                    {selectedImage.licenseUrl && (
                      <a
                        href={selectedImage.licenseUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="wikimedia-license-link"
                        title="View official license terms"
                      >
                        <span>Terms</span>
                        <ExternalLink size={12} />
                      </a>
                    )}
                  </div>
                </div>

                <div className="wikimedia-detail-group">
                  <span className="wikimedia-detail-label">Technical Specs</span>
                  <div className="wikimedia-specs-grid">
                    <div>
                      <small>Dimensions</small>
                      <strong>{selectedImage.width && selectedImage.height ? `${selectedImage.width} × ${selectedImage.height} px` : 'Unknown'}</strong>
                    </div>
                    <div>
                      <small>File Size</small>
                      <strong>{selectedImage.formattedSize}</strong>
                    </div>
                    <div>
                      <small>Format</small>
                      <strong>{selectedImage.mime.split('/')[1]?.toUpperCase() || 'IMAGE'}</strong>
                    </div>
                    {selectedImage.date && (
                      <div>
                        <small>Date</small>
                        <strong className="truncate">{selectedImage.date}</strong>
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions Toolbar */}
                <div className="wikimedia-modal-actions">
                  <button
                    type="button"
                    className="wikimedia-btn wikimedia-btn--download"
                    onClick={() => handleDownload(selectedImage)}
                    disabled={downloadingId === selectedImage.id}
                  >
                    {downloadingId === selectedImage.id ? (
                      <>
                        <RotateCw size={15} className="animate-spin" />
                        <span>Downloading...</span>
                      </>
                    ) : downloadSuccessId === selectedImage.id ? (
                      <>
                        <Check size={15} className="text-emerald-400" />
                        <span className="text-emerald-400">Downloaded</span>
                      </>
                    ) : (
                      <>
                        <ArrowDownToLine size={15} />
                        <span>Download Image</span>
                      </>
                    )}
                  </button>

                  <a
                    href={selectedImage.originalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="wikimedia-btn wikimedia-btn--secondary"
                  >
                    <ExternalLink size={14} />
                    <span>Open Original</span>
                  </a>

                  <a
                    href={selectedImage.descriptionUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="wikimedia-btn wikimedia-btn--secondary"
                  >
                    <Info size={14} />
                    <span>Source Page</span>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
