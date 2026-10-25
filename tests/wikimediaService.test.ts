import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  stripHtml,
  formatBytes,
  formatFileTitle,
  isImageFile,
  transformWikimediaPage,
  searchWikimediaImages,
} from '../src/services/wikimediaService.ts'

describe('Wikimedia Commons API & Metadata Service Tests', () => {
  test('stripHtml strips tags and decodes entities cleanly', () => {
    const raw = '<span class="artist"><a href="https://commons.wikimedia.org/wiki/User:Jane">Jane Doe</a></span> &amp; &quot;Studio&quot;'
    const cleaned = stripHtml(raw)
    assert.equal(cleaned, 'Jane Doe & "Studio"')

    assert.equal(stripHtml(null), '')
    assert.equal(stripHtml(undefined), '')
    assert.equal(stripHtml('Simple Text'), 'Simple Text')
    assert.equal(stripHtml('Line 1<br/>Line 2</p>Line 3'), 'Line 1 Line 2 Line 3')
  })

  test('formatBytes converts byte numbers to appropriate human readable units', () => {
    assert.equal(formatBytes(0), 'Unknown size')
    assert.equal(formatBytes(500), '500 B')
    assert.equal(formatBytes(2048), '2.0 KB')
    assert.equal(formatBytes(5242880), '5.0 MB')
    assert.equal(formatBytes(1073741824), '1.0 GB')
  })

  test('formatFileTitle removes File: prefix, file extension, and replaces underscores', () => {
    assert.equal(formatFileTitle('File:African_Bush_Elephant.jpg'), 'African Bush Elephant')
    assert.equal(formatFileTitle('File:Cosmic_Purple_Wallpaper.png'), 'Cosmic Purple Wallpaper')
    assert.equal(formatFileTitle(''), 'Untitled')
  })

  test('isImageFile identifies renderable images and rejects non-image media', () => {
    assert.equal(isImageFile('image/jpeg', 'File:Photo.jpg', 'https://example.com/thumb.jpg'), true)
    assert.equal(isImageFile('image/png', 'File:Graphic.png', 'https://example.com/thumb.png'), true)
    assert.equal(isImageFile('image/svg+xml', 'File:Vector.svg', 'https://example.com/thumb.svg'), true)
    assert.equal(isImageFile('audio/ogg', 'File:Speech.ogg', 'https://example.com/audio.png'), false)
    assert.equal(isImageFile('application/pdf', 'File:Document.pdf', 'https://example.com/doc.png'), false)
    assert.equal(isImageFile('video/webm', 'File:Video.webm', 'https://example.com/video.png'), false)
    assert.equal(isImageFile('image/jpeg', 'File:Missing.jpg', ''), false)
  })

  test('transformWikimediaPage parses full metadata faithfully without inventing attributes', () => {
    const mockPage = {
      pageid: 12345,
      ns: 6,
      title: 'File:African_Bush_Elephant.jpg',
      imageinfo: [
        {
          size: 4783815,
          width: 2592,
          height: 3888,
          thumburl: 'https://upload.wikimedia.org/thumb.jpg',
          thumbwidth: 640,
          thumbheight: 960,
          url: 'https://upload.wikimedia.org/original.jpg',
          descriptionurl: 'https://commons.wikimedia.org/wiki/File:African_Bush_Elephant.jpg',
          mime: 'image/jpeg',
          extmetadata: {
            Artist: { value: '<a href="https://example.com">John Doe</a>' },
            LicenseShortName: { value: 'CC BY-SA 4.0' },
            LicenseUrl: { value: 'https://creativecommons.org/licenses/by-sa/4.0' },
            UsageTerms: { value: 'Creative Commons Attribution-Share Alike 4.0' },
            Credit: { value: 'Own work' },
            ImageDescription: { value: 'An African bush elephant in the savanna' },
            DateTimeOriginal: { value: '2024-05-12' },
          },
        },
      ],
    }

    const item = transformWikimediaPage(mockPage)
    assert.ok(item !== null)
    assert.equal(item.pageId, 12345)
    assert.equal(item.title, 'File:African_Bush_Elephant.jpg')
    assert.equal(item.cleanTitle, 'African Bush Elephant')
    assert.equal(item.artist, 'John Doe')
    assert.equal(item.license, 'CC BY-SA 4.0')
    assert.equal(item.licenseUrl, 'https://creativecommons.org/licenses/by-sa/4.0')
    assert.equal(item.width, 2592)
    assert.equal(item.height, 3888)
    assert.equal(item.sizeBytes, 4783815)
    assert.equal(item.formattedSize, '4.6 MB')
    assert.equal(item.description, 'An African bush elephant in the savanna')
    assert.equal(item.date, '2024-05-12')
    assert.equal(item.thumbUrl, 'https://upload.wikimedia.org/thumb.jpg')
    assert.equal(item.originalUrl, 'https://upload.wikimedia.org/original.jpg')
  })

  test('transformWikimediaPage handles missing metadata gracefully with truthful fallbacks', () => {
    const sparsePage = {
      pageid: 99999,
      title: 'File:Mystery_Object.png',
      imageinfo: [
        {
          size: 1024,
          width: 100,
          height: 100,
          thumburl: 'https://upload.wikimedia.org/mystery.png',
          url: 'https://upload.wikimedia.org/mystery.png',
          mime: 'image/png',
          extmetadata: {},
        },
      ],
    }

    const item = transformWikimediaPage(sparsePage)
    assert.ok(item !== null)
    assert.equal(item.artist, 'Not specified')
    assert.equal(item.license, 'See Wikimedia page for license')
    assert.equal(item.licenseUrl, undefined)
    assert.equal(item.description, '')
  })

  test('searchWikimediaImages returns empty result for whitespace queries', async () => {
    const res = await searchWikimediaImages('   ')
    assert.equal(res.images.length, 0)
    assert.equal(res.continueParams, null)
  })
})
