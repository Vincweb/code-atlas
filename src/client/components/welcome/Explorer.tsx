import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'
import { projectPath } from '../../../shared/routes'
import type { FolderEntry, Place } from '../../../shared/types'
import { cx } from '../../util/cx'
import { useT } from '../../i18n'
import { useBrowse } from '../../state/queries'
import { navigate } from '../../state/router'
import { Badge, Button, ErrorBox, Spinner } from '../ui'
import {
  ArrowUpIcon,
  ChevronIcon,
  FolderIcon,
  HomeIcon,
  PencilIcon,
  SearchIcon,
  TerminalIcon,
} from './icons'
import { tildePath } from './RecentProjects'

const openProject = (dir: string) => navigate(projectPath(dir))

const crumbsOf = (path: string, home: string) => {
  const inHome = path === home || path.startsWith(`${home}/`)
  const base = inHome ? home : ''
  const rest = path.slice(base.length).split('/').filter(Boolean)
  const crumbs = [{ name: inHome ? '~' : '/', path: inHome ? home : '/' }]
  rest.forEach((name, index) =>
    crumbs.push({ name, path: `${base}/${rest.slice(0, index + 1).join('/')}` }),
  )
  return crumbs
}

const PlaceChip = ({
  place,
  active,
  onGo,
}: {
  place: Place
  active: boolean
  onGo: () => void
}) => {
  const t = useT()
  const Icon = place.kind === 'home' ? HomeIcon : place.kind === 'cwd' ? TerminalIcon : FolderIcon
  return (
    <button
      type="button"
      onClick={onGo}
      className={cx(
        'flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[12px]',
        active ? 'border-accent bg-accent/10 text-accent' : 'border-line hover:bg-hover',
      )}
    >
      <Icon className="size-3.5" />
      {place.kind === 'home' ? t.explorer.home : place.name}
    </button>
  )
}

const Row = ({
  entry,
  selected,
  onGo,
}: {
  entry: FolderEntry
  selected: boolean
  onGo: () => void
}) => {
  const t = useT()
  return (
    <li
      className={cx(
        'flex items-center gap-2 rounded-lg px-2 py-1',
        selected ? 'bg-hover' : 'hover:bg-hover',
      )}
    >
      <button
        type="button"
        onClick={onGo}
        onDoubleClick={entry.isProject ? () => openProject(entry.path) : undefined}
        className="flex min-w-0 flex-1 items-center gap-2 py-1 text-left"
      >
        <FolderIcon className={cx('size-4', entry.isProject ? 'text-accent' : 'text-muted')} />
        <span className={cx('truncate', entry.isProject && 'font-medium')}>{entry.name}</span>
        {entry.isGit && <Badge className="border-line text-muted">{t.explorer.git}</Badge>}
        {entry.isProject && (
          <Badge className="border-accent/40 bg-accent/10 text-accent">{t.explorer.project}</Badge>
        )}
        {entry.hasConfig && (
          <Badge className="border-good-line bg-good-bg text-good">{t.welcome.hasConfig}</Badge>
        )}
        <ChevronIcon className="ml-auto size-3.5 text-muted" />
      </button>
      {entry.isProject && (
        <Button primary className="text-[12px]" onClick={() => openProject(entry.path)}>
          {t.explorer.open}
        </Button>
      )}
    </li>
  )
}

export const Explorer = ({ places, home }: { places: Place[]; home: string | undefined }) => {
  const t = useT()
  const [path, setPath] = useState('')
  const [filter, setFilter] = useState('')
  const [cursor, setCursor] = useState(0)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const listRef = useRef<HTMLUListElement>(null)
  const listing = useBrowse(path)
  const data = listing.data

  const visible = useMemo(() => {
    const needle = filter.trim().toLowerCase()
    return (data?.directories ?? []).filter((entry) => entry.name.toLowerCase().includes(needle))
  }, [data, filter])

  useEffect(() => {
    listRef.current?.children[cursor]?.scrollIntoView({ block: 'nearest' })
  }, [cursor])

  const go = (next: string) => {
    setPath(next)
    setFilter('')
    setCursor(0)
    setEditing(false)
  }

  const onKey = (event: KeyboardEvent<HTMLInputElement>) => {
    const entry = visible[cursor]
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setCursor((value) => Math.min(value + 1, Math.max(visible.length - 1, 0)))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setCursor((value) => Math.max(value - 1, 0))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      if (event.metaKey || event.ctrlKey) {
        if (entry?.isProject) openProject(entry.path)
        else if (data?.isProject) openProject(data.path)
      } else if (entry) go(entry.path)
    } else if (event.key === 'Backspace' && filter === '' && data?.parent) {
      event.preventDefault()
      go(data.parent)
    }
  }

  const submitPath = (event: FormEvent) => {
    event.preventDefault()
    if (draft.trim()) go(draft.trim())
  }

  const homeDir = data?.home ?? home ?? ''

  return (
    <section className="flex min-w-0 flex-col gap-3">
      <h3 className="text-[11px] font-semibold tracking-wide text-muted uppercase">
        {t.explorer.title}
      </h3>

      <div className="flex flex-wrap gap-1.5" aria-label={t.explorer.places}>
        {places.map((place) => (
          <PlaceChip
            key={place.path}
            place={place}
            active={data?.path === place.path}
            onGo={() => go(place.path)}
          />
        ))}
      </div>

      <div className="flex flex-col overflow-hidden rounded-xl border border-line bg-bg">
        <div className="flex items-center gap-1 border-b border-line px-2 py-1.5">
          <button
            type="button"
            onClick={() => data?.parent && go(data.parent)}
            disabled={!data?.parent}
            title={t.explorer.up}
            aria-label={t.explorer.up}
            className="flex size-7 items-center justify-center rounded-md hover:bg-hover"
          >
            <ArrowUpIcon className="size-4" />
          </button>
          {editing ? (
            <form onSubmit={submitPath} className="flex min-w-0 flex-1 gap-1.5">
              <input
                autoFocus
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => event.key === 'Escape' && setEditing(false)}
                aria-label={t.explorer.pathLabel}
                spellCheck={false}
                className="min-w-0 flex-1 rounded-md border border-line bg-panel px-2 py-1 font-mono text-[12px]"
              />
              <Button type="submit" primary>
                {t.explorer.go}
              </Button>
            </form>
          ) : (
            <nav className="flex min-w-0 flex-1 items-center overflow-x-auto font-mono text-[12px]">
              {data &&
                crumbsOf(data.path, homeDir).map((crumb, index, all) => (
                  <span key={crumb.path} className="flex shrink-0 items-center">
                    {index > 0 && <span className="px-0.5 text-muted">/</span>}
                    <button
                      type="button"
                      onClick={() => go(crumb.path)}
                      className={cx(
                        'rounded px-1 py-0.5 hover:bg-hover',
                        index === all.length - 1 ? 'font-semibold' : 'text-muted',
                      )}
                    >
                      {crumb.name}
                    </button>
                  </span>
                ))}
            </nav>
          )}
          {listing.isFetching && <Spinner />}
          {!editing && (
            <button
              type="button"
              onClick={() => {
                setDraft(data ? tildePath(data.path, homeDir) : '')
                setEditing(true)
              }}
              title={t.explorer.editPath}
              aria-label={t.explorer.editPath}
              className="flex size-7 items-center justify-center rounded-md hover:bg-hover"
            >
              <PencilIcon className="size-4" />
            </button>
          )}
        </div>

        {data?.isProject && (
          <div className="flex items-center gap-3 border-b border-line bg-accent/10 px-3 py-2">
            <FolderIcon className="size-4 text-accent" />
            <span className="flex-1">{t.explorer.thisIsProject}</span>
            <Button primary onClick={() => openProject(data.path)}>
              {t.explorer.open}
            </Button>
          </div>
        )}

        <label className="flex items-center gap-2 border-b border-line px-3 py-1.5">
          <SearchIcon className="size-4 text-muted" />
          <input
            value={filter}
            onChange={(event) => {
              setFilter(event.target.value)
              setCursor(0)
            }}
            onKeyDown={onKey}
            placeholder={t.explorer.filter}
            spellCheck={false}
            className="min-w-0 flex-1 bg-transparent py-0.5 outline-none"
          />
        </label>

        {listing.error ? (
          <div className="p-3">
            <ErrorBox message={listing.error.message} onRetry={() => go('')} />
          </div>
        ) : (
          <ul ref={listRef} className="h-80 overflow-y-auto p-1.5">
            {data && visible.length === 0 && (
              <li className="px-2 py-6 text-center text-muted">
                {data.directories.length === 0 ? t.explorer.empty : t.explorer.noMatch}
              </li>
            )}
            {visible.map((entry, index) => (
              <Row
                key={entry.path}
                entry={entry}
                selected={index === cursor}
                onGo={() => go(entry.path)}
              />
            ))}
          </ul>
        )}
        <p className="border-t border-line px-3 py-1.5 text-[11px] text-muted">{t.explorer.hint}</p>
      </div>
    </section>
  )
}
