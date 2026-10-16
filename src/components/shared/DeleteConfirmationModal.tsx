import { Loader2, XCircle } from 'lucide-react'
import { useState } from 'react'

const STYLES = {
  buttonDanger:
    'rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-red-600/20 transition hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-red-400',
  buttonSecondary:
    'rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:bg-gray-50',
  bannerDanger:
    'rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700',
}

type DeleteConfirmationModalProps = {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => Promise<void>
  title: string
  itemName: string
}

export function DeleteConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  itemName,
}: DeleteConfirmationModalProps) {
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  if (!isOpen) return null

  const handleDelete = async () => {
    setDeleting(true)
    setError(null)
    try {
      await onConfirm()
    } catch (err: any) {
      setError(err.message || 'An error occurred during deletion.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <div
        className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      <div className="relative w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-gray-900/10">
        <div className="border-b border-gray-100 bg-gray-50/50 px-6 py-5">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold text-gray-900">{title}</h3>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={deleting}
                className={STYLES.buttonSecondary}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className={STYLES.buttonDanger}
              >
                {deleting ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  'Delete'
                )}
              </button>
            </div>
          </div>

          {error && (
            <div className="mt-4">
              <div className={`${STYLES.bannerDanger} flex items-start gap-3`}>
                <XCircle size={18} className="mt-0.5 text-red-600 shrink-0" />
                <div>{error}</div>
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-6">
          <p className="text-sm text-gray-700">
            Are you sure you want to delete <strong>{itemName}</strong>? This
            action cannot be undone.
          </p>
        </div>
      </div>
    </div>
  )
}
