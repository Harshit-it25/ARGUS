import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Upload, FileText, CheckCircle, AlertTriangle, Loader2, Trash2 } from 'lucide-react'
import { circularsApi } from '../services/api'

function getUser() {
  try {
    return JSON.parse(localStorage.getItem('argus_user') || '{}')
  } catch { return {} }
}

export default function Circulars() {
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const [circulars, setCirculars] = useState<any[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadStage, setUploadStage] = useState<'idle' | 'uploading' | 'processing' | 'done'>('idle')
  const [processingStep, setProcessingStep] = useState<number>(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const user = getUser()
  const orgId = user?.org_id

  useEffect(() => {
    if (orgId) {
      fetchCirculars()
    } else {
      setLoading(false)
    }
  }, [orgId])

  useEffect(() => {
    let interval: any;
    if (uploadStage === 'processing') {
      interval = setInterval(() => {
        setProcessingStep(prev => (prev < 2 ? prev + 1 : prev))
      }, 2500)
    }
    return () => clearInterval(interval)
  }, [uploadStage])

  const fetchCirculars = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await circularsApi.list(orgId)
      setCirculars(res.data)
    } catch (err: any) {
      let msg = 'Failed to load circulars'
      if (!err.response) {
        msg = 'Backend unavailable. Please verify the API server is running.'
      } else {
        msg = err.response.data?.detail || err.message || msg
      }
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    if (isUploading) return
    const file = e.dataTransfer.files[0]
    if (file) {
      handleUpload(file)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleUpload(file)
    }
  }

  const triggerFileSelect = () => {
    if (isUploading) return
    fileInputRef.current?.click()
  }

  const handleUpload = async (file: File) => {
    if (!orgId) {
      setError('Organization ID missing. Please log in again.')
      return
    }

    // 1. Validate file format
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (ext !== 'pdf' && ext !== 'docx' && ext !== 'doc') {
      setError('Unsupported file type. Only PDF and DOCX files are allowed.')
      return
    }

    // 2. Validate empty file
    if (file.size === 0) {
      setError('Invalid PDF. The uploaded file is empty.')
      return
    }

    // 3. Validate file size (e.g., max 10MB)
    const MAX_SIZE = 10 * 1024 * 1024 // 10MB
    if (file.size > MAX_SIZE) {
      setError('File too large. The maximum allowed file size is 10MB.')
      return
    }

    setIsUploading(true)
    setUploadProgress(0)
    setUploadStage('uploading')
    setProcessingStep(0)
    setError('')
    
    let createdCircularId = ''
    try {
      // Create clean title
      const cleanTitle = file.name
        .replace(/\.[^/.]+$/, "") // remove extension
        .replace(/[_-]/g, " ") // replace underscores/hyphens with spaces
      
      setUploadProgress(30)
      
      // Create circular record in DB
      const createRes = await circularsApi.create({
        title: cleanTitle,
        org_id: orgId,
        effective_date: new Date().toISOString().split('T')[0]
      })
      
      createdCircularId = createRes.data.id
      
      // Upload the file (triggers text extraction & obligation generation in background)
      await circularsApi.upload(createdCircularId, file, (progressEvent: any) => {
        if (progressEvent.total) {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total)
          setUploadProgress(percentCompleted)
          if (percentCompleted === 100) {
            setUploadStage('processing')
          }
        }
      })
      
      // Poll for completion
      let processing = true;
      while (processing) {
        await new Promise(r => setTimeout(r, 2000)); // Poll every 2 seconds
        try {
          const circRes = await circularsApi.get(createdCircularId);
          const status = circRes.data.status;
          if (status === 'obligations_extracted' || status === 'mapped' || status === 'stress_tested') {
            processing = false;
          } else if (status === 'extraction_failed') {
            throw new Error(circRes.data.processing_errors?.[0] || "Extraction failed");
          } else if (status === 'failed') {
            throw new Error("Document processing failed on the server.");
          }
        } catch (pollErr: any) {
          if (pollErr.message === "Document processing failed on the server.") {
            throw pollErr;
          }
          // if network error during polling, keep trying
        }
      }
      
      setUploadStage('done')
      
      // Refresh list
      await fetchCirculars()
      
      // Navigate to obligations page after a short delay
      setTimeout(() => {
        setIsUploading(false)
        navigate(`/circulars/${createdCircularId}/obligations`)
      }, 1500)
      
    } catch (err: any) {
      if (createdCircularId) {
        circularsApi.delete(createdCircularId).catch(() => {})
      }
      
      let msg = 'File upload or obligation extraction failed'
      if (!err.response) {
        msg = 'Backend unavailable. Please verify the API server is running.'
      } else if (err.response.status === 400) {
        msg = err.response.data?.detail || 'Invalid PDF or unsupported file type.'
      } else if (err.response.status === 413) {
        msg = 'File too large. Please upload a smaller file.'
      } else if (err.response.status >= 500) {
        msg = 'Server error. The server encountered an issue processing the file.'
      } else if (err.code === 'ECONNABORTED') {
        msg = 'Connection timeout. The request took too long.'
      } else {
        msg = err.response.data?.detail || err.message || msg
      }
      setError(msg)
      setIsUploading(false)
      setUploadProgress(0)
      setUploadStage('idle')
      setProcessingStep(0)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'stress_tested': return 'badge-warning'
      case 'mapped': return 'badge-info'
      case 'obligations_extracted': return 'badge-success'
      case 'extraction_failed': return 'badge-critical'
      case 'uploaded': return 'badge-neutral'
      default: return 'badge-neutral'
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'stress_tested': return 'Stress Tested'
      case 'mapped': return 'Mapped'
      case 'obligations_extracted': return 'Obligations Extracted'
      case 'extraction_failed': return 'Extraction Failed'
      case 'uploaded': return 'Uploaded'
      default: return status
    }
  }

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    if (window.confirm('Are you sure you want to delete this circular and all its associated obligations?')) {
      try {
        await circularsApi.delete(id)
        fetchCirculars()
      } catch (err) {
        setError('Failed to delete circular')
      }
    }
  }

  const stages = [
    { key: 'uploaded', label: 'Uploaded' },
    { key: 'ocr', label: 'OCR' },
    { key: 'extraction', label: 'Extraction' },
    { key: 'mapping', label: 'Mapping' },
    { key: 'stress_test', label: 'Stress Test' },
    { key: 'completed', label: 'Completed' },
  ]
  // Map the existing uploadStage/processingStep state onto the 6-stage visual timeline
  // without touching the underlying upload/poll logic.
  const activeStageIndex =
    uploadStage === 'idle' ? -1 :
    uploadStage === 'uploading' ? 0 :
    uploadStage === 'processing' ? 1 + processingStep : // 1,2,3 across OCR/Extraction/Mapping
    5 // done

  return (
    <div className="space-y-6 animate-fade-in relative z-10 p-8 max-w-[1600px] mx-auto argus-ground">
      <div className="flex items-center justify-between border-b border-argus-line pb-5">
        <div>
          <p className="eyebrow mb-1">Document Intake</p>
          <h2 className="font-display text-2xl font-bold text-argus-text tracking-tight">Circulars</h2>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-argus-critical/[0.08] border border-argus-critical/30 rounded-lg flex items-center gap-3 text-argus-critical">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <div className="flex-1">
            <span className="text-sm font-medium">{error}</span>
            <button onClick={fetchCirculars} className="ml-3 text-xs underline font-semibold hover:text-argus-text transition-colors">
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Upload Area */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={triggerFileSelect}
        className={`panel border-2 border-dashed p-12 text-center transition-all ${
          isUploading ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:bg-white/[0.02]'
        } ${isDragging ? '!border-argus-accent bg-argus-accent/[0.05]' : 'border-argus-line'}`}
      >
        <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".pdf,.docx,.doc" disabled={isUploading} className="hidden" />
        <div className="w-16 h-16 mx-auto rounded-2xl border border-argus-line bg-white/[0.02] flex items-center justify-center mb-6">
          <Upload className="w-7 h-7 text-argus-text-secondary" />
        </div>
        <h3 className="font-display text-lg font-medium text-argus-text mb-2">Drop SEBI circular PDF or DOCX here</h3>
        <p className="text-sm text-argus-text-faint mb-8">or click to browse (PDF, DOCX supported, max 10MB)</p>
        <button disabled={isUploading} className="btn-primary px-8">Select File</button>

        {isUploading && (
          <div className="mt-8 max-w-xl mx-auto text-left" onClick={(e) => e.stopPropagation()}>
            {/* 6-stage processing timeline */}
            <div className="panel-solid p-6">
              <div className="flex items-center justify-between mb-2">
                {stages.map((stage, i) => {
                  const isDone = i < activeStageIndex || uploadStage === 'done'
                  const isActive = i === activeStageIndex && uploadStage !== 'done'
                  return (
                    <div key={stage.key} className="flex-1 flex flex-col items-center relative">
                      {i > 0 && (
                        <div className={`absolute right-1/2 top-3.5 h-px w-full -z-0 ${isDone || (isActive && i <= activeStageIndex) ? 'bg-argus-accent' : 'bg-argus-line'}`} style={{ width: '100%', right: '50%' }} />
                      )}
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center border-2 z-10 bg-argus-bg2 transition-colors ${
                        isDone ? 'border-argus-success bg-argus-success/20' :
                        isActive ? 'border-argus-accent' : 'border-argus-line'
                      }`}>
                        {isDone ? (
                          <CheckCircle className="w-4 h-4 text-argus-success" />
                        ) : isActive ? (
                          <Loader2 className="w-3.5 h-3.5 text-argus-accent animate-spin" />
                        ) : (
                          <div className="w-1.5 h-1.5 rounded-full bg-argus-text-faint" />
                        )}
                      </div>
                      <span className={`mt-2 text-[10px] uppercase tracking-wide font-medium text-center ${isDone || isActive ? 'text-argus-text' : 'text-argus-text-faint'}`}>
                        {stage.label}
                      </span>
                    </div>
                  )
                })}
              </div>

              {uploadStage === 'uploading' && (
                <div className="mt-6">
                  <div className="flex items-center justify-between text-sm font-medium mb-2">
                    <span className="text-argus-text">Uploading PDF…</span>
                    <span className="font-mono text-argus-accent">{uploadProgress}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                    <div className="h-full bg-argus-accent transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                  </div>
                </div>
              )}
            </div>

            {uploadStage === 'done' && (
              <div className="mt-4 flex items-center justify-center gap-2 text-argus-success">
                <CheckCircle className="w-5 h-5" />
                <span className="text-sm font-semibold tracking-wide">Complete! Redirecting…</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Circulars List */}
      <div className="panel overflow-hidden mt-8">
        <div className="p-6 border-b border-argus-line">
          <h3 className="eyebrow">All Circulars</h3>
        </div>

        {loading ? (
          <div className="p-6 space-y-3">
            {[...Array(3)].map((_, i) => <div key={i} className="skeleton h-14 w-full skeleton-shimmer" />)}
          </div>
        ) : circulars.length > 0 ? (
          <div className="divide-y divide-argus-line">
            {circulars.map((circular, i) => (
              <div key={circular.id} onClick={() => navigate(`/circulars/${circular.id}/obligations`)}
                className="p-5 flex flex-col hover:bg-white/[0.02] transition-colors cursor-pointer group">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <span className="font-mono text-xs text-argus-text-faint w-6 shrink-0">{String(i + 1).padStart(2, '0')}</span>
                    <div className="w-11 h-11 rounded-lg flex items-center justify-center border border-argus-line bg-white/[0.02] shrink-0">
                      <FileText className="w-5 h-5 text-argus-text-secondary group-hover:text-argus-text transition-colors" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-argus-text-secondary group-hover:text-argus-text transition-colors">{circular.title}</p>
                      <p className="font-mono text-xs text-argus-text-faint mt-1">
                        Effective: {circular.effective_date} <span className="mx-2 opacity-50">•</span> Created: {new Date(circular.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`badge ${getStatusBadge(circular.status)}`}>{getStatusLabel(circular.status)}</span>
                    <button onClick={(e) => handleDelete(e, circular.id)} className="p-2 text-argus-text-faint hover:text-argus-critical hover:bg-argus-critical/10 rounded-lg transition-colors" title="Delete Circular">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                {circular.status === 'extraction_failed' && (
                  <div className="mt-4 p-4 bg-argus-critical/[0.06] rounded-lg text-sm text-argus-critical border border-argus-critical/30 flex flex-col gap-1">
                    <span className="font-semibold">Extraction Failed</span>
                    <span className="text-argus-text-secondary">Reason: {circular.processing_errors?.[0] || 'Unknown API failure'}</span>
                    <span className="font-medium mt-1">Status: Retry Required</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="p-16 text-center text-argus-text-faint">
            No circulars uploaded yet.
          </div>
        )}
      </div>
    </div>
  )
}
