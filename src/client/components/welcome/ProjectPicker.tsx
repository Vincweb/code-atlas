import { useState } from 'react'
import type { ProjectsPayload } from '../../../shared/types'
import { cx } from '../../util/cx'
import { useT } from '../../i18n'
import { Button, ErrorBox, Spinner } from '../ui'
import { Explorer } from './Explorer'
import { FolderIcon } from './icons'
import { RecentProjects } from './RecentProjects'

type Props = {
  data: ProjectsPayload | undefined
  pending: boolean
  error: Error | null
  onRetry: () => void
}

export const ProjectPicker = ({ data, pending, error, onRetry }: Props) => {
  const t = useT()
  const [exploring, setExploring] = useState(false)

  return (
    <section
      id="open"
      className="flex scroll-mt-6 flex-col gap-5 rounded-2xl border border-line bg-panel p-5 sm:p-6"
    >
      <header className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-[20px] font-semibold tracking-tight">{t.landing.openTitle}</h2>
          <p className="text-muted">{t.landing.openText}</p>
        </div>
        <Button
          primary={!exploring}
          aria-expanded={exploring}
          onClick={() => setExploring((open) => !open)}
          className="flex items-center gap-2 px-3 py-1.5"
        >
          <FolderIcon className="size-4" />
          {exploring ? t.explorer.hide : t.explorer.show}
        </Button>
      </header>

      {pending && (
        <p className="flex items-center gap-2 text-muted">
          <Spinner /> {t.common.loading}
        </p>
      )}
      {error && <ErrorBox message={error.message} onRetry={onRetry} />}

      <div
        className={cx(
          'grid grid-cols-1 gap-6',
          exploring && 'lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]',
        )}
      >
        <RecentProjects home={data?.home} wide={!exploring} />
        {exploring && <Explorer places={data?.places ?? []} home={data?.home} />}
      </div>
    </section>
  )
}
