
import { useRef, useState } from 'react'
import type { ChangeEvent, DragEvent } from 'react'
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  FileImage,
  LoaderCircle,
  RotateCcw,
  Sparkles,
  Upload,
  X,
} from 'lucide-react'
import { supabase } from './lib/supabase'
import './CivicIssueDetector.css'

type IssueAnalysis = {
  issue: string
  category: string
  priority: 'Low' | 'Medium' | 'High' | 'Critical'
  confidence: 'Low' | 'Medium' | 'High'
  reasoning: string
  reportDraft: string
  safetyAdvice: string
}

type Props = {
  onUseDraft: (draft: string) => void
}

const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export default function CivicIssueDetector({ onUseDraft }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [image, setImage] = useState<File | null>(null)
  const [preview, setPreview] = useState('')
  const [analysis, setAnalysis] = useState<IssueAnalysis | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [draftApplied, setDraftApplied] = useState(false)
  const [isDragging, setIsDragging] = useState(false)

  function handleFile(file?: File) {
    if (!file) return

    setError('')
    setAnalysis(null)
    setDraftApplied(false)

    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError('Choose a JPG, PNG, or WebP image.')
      return
    }

    if (file.size > MAX_IMAGE_BYTES) {
      setError('The image must be 5 MB or smaller.')
      return
    }

    const reader = new FileReader()

    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setImage(file)
        setPreview(reader.result)
      } else {
        setError('Could not preview this image. Please choose another.')
      }
    }

    reader.onerror = () => {
      setError('Could not read this image. Please try another.')
    }

    reader.readAsDataURL(file)
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    handleFile(file)
  }

  function handleDragOver(event: DragEvent<HTMLElement>) {
    event.preventDefault()
    if (!loading) setIsDragging(true)
  }

  function handleDragLeave(event: DragEvent<HTMLElement>) {
    event.preventDefault()
    setIsDragging(false)
  }

  function handleDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault()
    setIsDragging(false)

    if (loading) return

    handleFile(event.dataTransfer.files?.[0])
  }

  function clearImage() {
    if (loading) return

    setImage(null)
    setPreview('')
    setAnalysis(null)
    setError('')
    setDraftApplied(false)
    setIsDragging(false)

    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  async function analyzeImage() {
    if (!image || !preview || loading) return

    setLoading(true)
    setError('')
    setAnalysis(null)
    setDraftApplied(false)

    try {
      const commaIndex = preview.indexOf(',')

      if (commaIndex < 0) {
        throw new Error('Could not read the image data. Please choose it again.')
      }

      const base64 = preview.slice(commaIndex + 1)

      const { data, error: functionError } = await supabase.functions.invoke(
        'civic-issue-detector',
        {
          body: {
            imageBase64: base64,
            mimeType: image.type,
          },
        },
      )

      if (functionError) throw functionError

      if (data?.error) {
        throw new Error(data.error)
      }

      const result = data?.analysis as IssueAnalysis | undefined

      if (
        !result ||
        typeof result.issue !== 'string' ||
        typeof result.category !== 'string' ||
        typeof result.reportDraft !== 'string' ||
        !['Low', 'Medium', 'High', 'Critical'].includes(result.priority) ||
        !['Low', 'Medium', 'High'].includes(result.confidence)
      ) {
        throw new Error('The AI returned an unexpected result. Please try again.')
      }

      setAnalysis(result)
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Could not analyze this image. Please try again.',
      )
    } finally {
      setLoading(false)
    }
  }

  function useDraft() {
    if (!analysis) return

    onUseDraft(analysis.reportDraft)
    setDraftApplied(true)
  }

  const confidenceWidth = {
    Low: '33%',
    Medium: '66%',
    High: '100%',
  }

  return (
    <section className="civic-issue-ai">
      <div className="civic-issue-ai__header">
        <div className="civic-issue-ai__icon">
          <Sparkles size={22} />
        </div>

        <div className="civic-issue-ai__header-copy">
          <div className="civic-issue-ai__eyebrow">
            CIVICQUEST AI TOOLS
          </div>
          <h3>AI Photo Issue Detector</h3>
          <p>Turn a civic issue photo into a report draft.</p>
        </div>
      </div>

      <div className="civic-issue-ai__notice">
        <AlertTriangle size={17} />
        <p>
          AI suggestions are preliminary. Review the result and confirm the
          details yourself. Avoid photographing identifiable people or private
          information.
        </p>
      </div>

      {!preview ? (
        <button
          type="button"
          className={`civic-issue-ai__upload${isDragging ? ' civic-issue-ai__upload--dragging' : ''}`}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          disabled={loading}
        >
          <span className="civic-issue-ai__upload-icon">
            <Camera size={27} />
          </span>

          <strong>
            {isDragging ? 'Drop your photo here' : 'Upload a civic issue photo'}
          </strong>

          <span>Drag and drop, or browse your device</span>
          <span className="civic-issue-ai__file-types">
            <FileImage size={14} />
            JPG, PNG or WebP · Up to 5 MB
          </span>

          <span className="civic-issue-ai__upload-action">
            <Upload size={15} />
            Choose photo
          </span>
        </button>
      ) : (
        <div
          className={`civic-issue-ai__preview${isDragging ? ' civic-issue-ai__preview--dragging' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div className="civic-issue-ai__preview-top">
            <div>
              <span className="civic-issue-ai__status-dot" />
              <strong>{loading ? 'Analyzing image' : 'Photo selected'}</strong>
            </div>

            <button
              type="button"
              className="civic-issue-ai__change-photo"
              onClick={() => fileInputRef.current?.click()}
              disabled={loading}
            >
              <RotateCcw size={14} />
              Replace
            </button>
          </div>

          <div className="civic-issue-ai__image-wrap">
            <img src={preview} alt="Selected civic issue for AI analysis" />

            {loading && (
              <div className="civic-issue-ai__image-scanner" aria-hidden="true">
                <span />
              </div>
            )}
          </div>

          <div className="civic-issue-ai__file-info">
            <span>
              <FileImage size={15} />
              <span className="civic-issue-ai__filename">
                {image?.name}
              </span>
              {image && (
                <small>{(image.size / (1024 * 1024)).toFixed(2)} MB</small>
              )}
            </span>

            <button
              type="button"
              onClick={clearImage}
              disabled={loading}
              aria-label="Remove selected photo"
              title="Remove photo"
            >
              <X size={17} />
            </button>
          </div>

          {isDragging && (
            <div className="civic-issue-ai__drop-hint">
              Drop to use this photo instead
            </div>
          )}
        </div>
      )}

      <input
        ref={fileInputRef}
        className="civic-issue-ai__hidden-input"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileChange}
      />

      {preview && !analysis && (
        <button
          type="button"
          className="civic-issue-ai__analyze"
          onClick={() => void analyzeImage()}
          disabled={loading}
        >
          {loading ? (
            <>
              <LoaderCircle
                className="civic-issue-ai__spinner"
                size={18}
              />
              Analyzing your photo…
            </>
          ) : (
            <>
              <Sparkles size={18} />
              Detect issue with AI
            </>
          )}
        </button>
      )}

      {loading && (
        <div
          className="civic-issue-ai__scanning"
          role="status"
          aria-live="polite"
        >
          <div className="civic-issue-ai__scanning-icon">
            <Sparkles size={20} />
          </div>

          <div className="civic-issue-ai__scanning-content">
            <strong>AI analysis in progress</strong>
            <p>Processing your photo. This may take a few moments.</p>

            <div className="civic-issue-ai__progress">
              <span />
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="civic-issue-ai__error" role="alert">
          <AlertTriangle size={17} />
          <p>{error}</p>
        </div>
      )}

      {analysis && (
        <div className="civic-issue-ai__result">
          <div className="civic-issue-ai__result-heading">
            <span className="civic-issue-ai__success-icon">
              <CheckCircle2 size={21} />
            </span>

            <div>
              <h4>Analysis ready</h4>
              <p>Review these AI-generated suggestions before submitting.</p>
            </div>
          </div>

          <div className="civic-issue-ai__result-field civic-issue-ai__issue-card">
            <span>LIKELY ISSUE</span>
            <strong>{analysis.issue}</strong>
          </div>

          <div className="civic-issue-ai__result-grid">
            <div className="civic-issue-ai__result-field">
              <span>SUGGESTED CATEGORY</span>
              <strong>{analysis.category}</strong>
            </div>

            <div className="civic-issue-ai__result-field">
              <span>PRELIMINARY PRIORITY</span>
              <strong
                className={`civic-issue-ai__priority civic-issue-ai__priority--${analysis.priority.toLowerCase()}`}
              >
                {analysis.priority}
              </strong>
            </div>
          </div>

          <div className="civic-issue-ai__result-field civic-issue-ai__confidence">
            <div className="civic-issue-ai__confidence-heading">
              <span>VISUAL CONFIDENCE</span>
              <strong>{analysis.confidence}</strong>
            </div>

            <div
              className="civic-issue-ai__confidence-track"
              role="img"
              aria-label={`Qualitative visual confidence: ${analysis.confidence}`}
            >
              <span
                className={`civic-issue-ai__confidence-fill civic-issue-ai__confidence-fill--${analysis.confidence.toLowerCase()}`}
                style={{ width: confidenceWidth[analysis.confidence] }}
              />
            </div>

            <small>
              Confidence is a qualitative AI estimate, not a verified
              probability.
            </small>
          </div>

          <div className="civic-issue-ai__explanation">
            <strong>
              <Sparkles size={15} />
              Why this suggestion?
            </strong>
            <p>{analysis.reasoning || 'No additional explanation was provided.'}</p>
          </div>

          {analysis.safetyAdvice && (
            <div className="civic-issue-ai__safety">
              <AlertTriangle size={17} />
              <p>{analysis.safetyAdvice}</p>
            </div>
          )}

          <div className="civic-issue-ai__draft">
            <strong>
              <FileImage size={15} />
              Suggested report draft
            </strong>
            <p>{analysis.reportDraft}</p>
          </div>

          <p className="civic-issue-ai__disclaimer">
            Priority is an AI estimate from the photo, not an official
            assessment. The image may not show the full situation. Verify the
            details before submitting your contribution.
          </p>

          <button
            type="button"
            className="civic-issue-ai__use-draft"
            onClick={useDraft}
          >
            {draftApplied ? (
              <>
                <CheckCircle2 size={18} />
                Draft copied into contribution notes
              </>
            ) : (
              <>
                <Sparkles size={18} />
                Use draft in contribution notes
              </>
            )}
          </button>

          {draftApplied && (
            <p className="civic-issue-ai__applied-message" role="status">
              Your contribution notes have been filled in. Review them before
              submitting your proof.
            </p>
          )}

          <button
            type="button"
            className="civic-issue-ai__try-again"
            onClick={() => {
              setAnalysis(null)
              setError('')
              setDraftApplied(false)
            }}
          >
            <RotateCcw size={14} />
            Analyze this photo again
          </button>
        </div>
      )}
    </section>
  )
}
