import type { Analysis } from '../../shared/types'
import { useT } from '../i18n'
import { formatDuration } from '../util/format'
import { Link } from './Link'
import { Prefs } from './Prefs'
import { HeaderSkeleton } from './skeletons'
import { Badge, Button, Spinner } from './ui'
import { Mark } from './welcome/Mark'

type Props = { busy: boolean; onReanalyse: () => void } & (
  { analysis: Analysis; root?: undefined } | { analysis?: undefined; root: string }
)

export const ProjectHeader = ({ analysis, root, busy, onReanalyse }: Props) => {
  const t = useT()
  return (
    <header className="flex flex-col gap-3 pt-1 md:flex-row md:items-center md:gap-4">
      <div className="flex min-w-0 items-center gap-3">
        <Link
          to="/"
          title={t.project.back}
          aria-label={t.project.back}
          className="flex shrink-0 items-center gap-2 rounded-lg px-1 py-1 text-muted hover:bg-hover hover:text-text"
        >
          <span aria-hidden="true">←</span>
          <Mark className="size-7" />
        </Link>
        <div className="min-w-0">
          {analysis ? (
            <>
              <h1 className="truncate text-[16px] font-semibold">{analysis.label}</h1>
              <p className="truncate font-mono text-[12px] text-muted" title={analysis.root}>
                {analysis.root}
              </p>
            </>
          ) : (
            <>
              <HeaderSkeleton />
              <span className="sr-only">{root}</span>
            </>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-muted md:ml-auto md:justify-end">
        {analysis?.commit && (
          <code className="hidden font-mono sm:inline">{analysis.commit.slice(0, 7)}</code>
        )}
        {analysis?.dirty && (
          <Badge className="border-warn-line bg-warn-bg text-warn">{t.project.modified}</Badge>
        )}
        {analysis && (
          <span className="hidden lg:inline">
            {t.project.analysedIn(formatDuration(analysis.durationMs))}
          </span>
        )}
        <Button
          onClick={onReanalyse}
          disabled={busy}
          className="flex items-center gap-1.5 text-text"
        >
          {busy && <Spinner />}
          {t.project.reanalyse}
        </Button>
        <span className="ml-auto md:ml-0">
          <Prefs />
        </span>
      </div>
    </header>
  )
}
