import { useEffect, useId, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent, Ref, RefObject } from 'react'
import { projectPath } from '../../shared/routes'
import type { Tab } from '../../shared/routes'
import type { Analysis, PackageInfo } from '../../shared/types'
import { useT } from '../i18n'
import type { Strings } from '../i18n'
import { navigate } from '../state/router'
import { cx } from '../util/cx'
import { packageIn } from '../../shared/scope'
import { BAND_BOX, BAND_TEXT, bandOf } from '../util/score'
import { Link } from './Link'
import { ChevronIcon, SearchIcon } from './icons'

/** One line of the list: the whole repository (dir null) or a package. */
type Choice = {
  dir: string | null
  name: string
  detail: string
  files: number
  score: number | null
}

type Group = { top: string; choices: Choice[] }

const ScoreChip = ({ score }: { score: number | null }) => {
  const band = bandOf(score)
  return (
    <span
      className={cx(
        'inline-flex min-w-8 shrink-0 justify-center rounded-md border px-1 text-[11px] leading-5 font-semibold tabular-nums',
        BAND_BOX[band],
        BAND_TEXT[band],
      )}
    >
      {score ?? '–'}
    </span>
  )
}

const choiceOf = (pkg: PackageInfo): Choice => ({
  dir: pkg.dir,
  name: pkg.name,
  detail: pkg.name === pkg.dir ? '' : pkg.dir,
  files: pkg.stats.files,
  score: pkg.scores.overall,
})

/** The packages that match the search, grouped by their top folder: apps, packages… */
const groupsOf = (packages: PackageInfo[], needle: string): Group[] => {
  const groups = new Map<string, Choice[]>()
  for (const pkg of packages) {
    if (needle && !`${pkg.name} ${pkg.dir}`.toLowerCase().includes(needle)) continue
    const top = pkg.dir.split('/')[0] ?? pkg.dir
    groups.set(top, [...(groups.get(top) ?? []), choiceOf(pkg)])
  }
  return [...groups.entries()].map(([top, choices]) => ({
    top,
    choices: choices.sort((a, b) => a.name.localeCompare(b.name)),
  }))
}

const OptionRow = ({
  id,
  choice,
  selected,
  active,
  onPick,
  onHover,
}: {
  id: string
  choice: Choice
  selected: boolean
  active: boolean
  onPick: () => void
  onHover: () => void
}) => {
  const t = useT()
  return (
    <li
      id={id}
      role="option"
      aria-selected={selected}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onPick}
      onMouseMove={onHover}
      className={cx(
        'flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-1.5',
        active && 'bg-hover',
      )}
    >
      <span aria-hidden="true" className={cx('w-3 shrink-0 text-accent', !selected && 'invisible')}>
        ✓
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className={cx('truncate', selected && 'font-semibold')}>{choice.name}</span>
        {choice.detail && (
          <span className="truncate font-mono text-[11px] text-muted">{choice.detail}</span>
        )}
      </span>
      <span className="hidden shrink-0 text-[11px] text-muted tabular-nums sm:inline">
        {t.packages.files(choice.files)}
      </span>
      <ScoreChip score={choice.score} />
    </li>
  )
}

/** Picks with ↑ ↓ Enter, closes on Escape or a click outside, and gives the focus back. */
const usePicker = (
  refs: { box: RefObject<HTMLDivElement | null>; trigger: RefObject<HTMLButtonElement | null> },
  count: number,
  onChoose: (index: number) => void,
) => {
  const { box, trigger } = refs
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const close = () => {
    setOpen(false)
    trigger.current?.focus()
  }
  const pick = (index: number) => {
    close()
    onChoose(index)
  }
  useEffect(() => {
    if (!open) return
    const outside = (event: MouseEvent) => {
      if (!box.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', outside)
    return () => document.removeEventListener('mousedown', outside)
  }, [open, box])
  const moves: Record<string, number> = { ArrowDown: 1, ArrowUp: -1 }
  const onKey = (event: KeyboardEvent) => {
    const move = moves[event.key]
    if (move !== undefined) {
      event.preventDefault()
      setActive((index) => (index + move + count) % Math.max(count, 1))
    } else if (event.key === 'Enter' && count > 0) {
      event.preventDefault()
      pick(active)
    } else if (event.key === 'Escape') close()
  }
  return { open, setOpen, active, setActive, pick, onKey }
}

const Trigger = ({
  ids,
  current,
  open,
  buttonRef,
  onToggle,
}: {
  ids: string
  current: Choice
  open: boolean
  buttonRef: Ref<HTMLButtonElement>
  onToggle: () => void
}) => (
  <button
    ref={buttonRef}
    type="button"
    onClick={onToggle}
    onKeyDown={(event) => {
      if (!open && event.key === 'ArrowDown') onToggle()
    }}
    aria-haspopup="listbox"
    aria-expanded={open}
    aria-labelledby={`${ids}-label ${ids}-value`}
    className={cx(
      'flex max-w-full min-w-0 items-center gap-2.5 rounded-lg border bg-panel py-1 pr-2 pl-3 hover:bg-hover',
      open ? 'border-accent ring-1 ring-accent' : 'border-line',
    )}
  >
    <span id={`${ids}-value`} className="flex min-w-0 items-baseline gap-2">
      <span className="truncate font-medium">{current.name}</span>
      <span className="hidden truncate font-mono text-[11px] text-muted sm:inline">
        {current.detail}
      </span>
    </span>
    <ScoreChip score={current.score} />
    <ChevronIcon
      className={cx(
        'size-4 shrink-0 text-muted transition-transform',
        open ? '-rotate-90' : 'rotate-90',
      )}
    />
  </button>
)

const Menu = ({
  ids,
  words,
  query,
  onQuery,
  onKey,
  choices,
  groups,
  selected,
  active,
  onActive,
  onPick,
}: {
  ids: string
  words: Strings['packages']
  query: string
  onQuery: (value: string) => void
  onKey: (event: KeyboardEvent) => void
  choices: Choice[]
  groups: Group[]
  selected: string | null
  active: number
  onActive: (index: number) => void
  onPick: (index: number) => void
}) => {
  const optionId = (index: number) => `${ids}-option-${index}`
  useEffect(() => {
    document.getElementById(optionId(active))?.scrollIntoView({ block: 'nearest' })
  })
  const row = (choice: Choice, index: number) => (
    <OptionRow
      key={choice.dir ?? ''}
      id={optionId(index)}
      choice={choice}
      selected={choice.dir === selected}
      active={index === active}
      onPick={() => onPick(index)}
      onHover={() => onActive(index)}
    />
  )
  // The rows are numbered in the order of `choices`: the whole repository, then each group.
  const whole = choices[0]?.dir === null ? choices[0] : null
  let next = whole ? 1 : 0
  return (
    <div className="absolute top-full right-0 left-0 z-30 mt-1.5 flex flex-col sm:right-auto sm:w-[30rem] rounded-xl border border-line bg-panel shadow-xl shadow-black/20">
      <label className="flex items-center gap-2 border-b border-line px-3 py-2">
        <SearchIcon className="size-4 text-muted" />
        <input
          autoFocus
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          onKeyDown={onKey}
          placeholder={words.search}
          spellCheck={false}
          role="combobox"
          aria-expanded="true"
          aria-autocomplete="list"
          aria-controls={`${ids}-list`}
          aria-activedescendant={choices.length ? optionId(active) : undefined}
          className="min-w-0 flex-1 bg-transparent outline-none"
        />
      </label>
      <ul
        id={`${ids}-list`}
        role="listbox"
        aria-labelledby={`${ids}-label`}
        className="flex max-h-[min(26rem,60vh)] flex-col overflow-y-auto p-1.5"
      >
        {whole && row(whole, 0)}
        {groups.map((group) => (
          <li key={group.top} role="presentation" className="mt-1.5 first:mt-0">
            <span className="block px-2.5 pt-1 pb-0.5 text-[11px] font-semibold tracking-wide text-muted uppercase">
              {group.top === '.' ? words.root : group.top}
            </span>
            <ul role="group" aria-label={group.top}>
              {group.choices.map((choice) => row(choice, next++))}
            </ul>
          </li>
        ))}
        {choices.length === 0 && <li className="px-2.5 py-2 text-muted">{words.noMatch}</li>}
      </ul>
    </div>
  )
}

/** Picks the package of a monorepo the whole page is scoped to. */
export const PackageBar = ({
  analysis,
  root,
  tab,
  pkg,
}: {
  analysis: Analysis
  root: string
  tab: Tab
  pkg: string | null
}) => {
  const t = useT()
  const ids = useId()
  const [query, setQuery] = useState('')
  const trigger = useRef<HTMLButtonElement>(null)
  const box = useRef<HTMLDivElement>(null)
  const packages = useMemo(() => analysis.workspace?.packages ?? [], [analysis.workspace])
  const needle = query.trim().toLowerCase()
  const groups = useMemo(() => groupsOf(packages, needle), [packages, needle])
  const info = packageIn(analysis, pkg)
  const whole: Choice = {
    dir: null,
    name: t.packages.whole,
    detail: t.packages.count(packages.length),
    files: analysis.stats.files,
    score: analysis.scores.overall,
  }
  const choices = [...(needle ? [] : [whole]), ...groups.flatMap((group) => group.choices)]
  const scoped = (dir: string | null) =>
    projectPath(root, tab === 'config' || tab === 'security' ? 'overview' : tab, null, dir)
  const picker = usePicker({ box, trigger }, choices.length, (index) => {
    const choice = choices[index]
    if (choice) navigate(scoped(choice.dir))
  })

  if (!analysis.workspace) return null
  const toggle = () => {
    setQuery('')
    picker.setActive(
      Math.max(
        0,
        choices.findIndex((choice) => choice.dir === pkg),
      ),
    )
    picker.setOpen(!picker.open)
  }

  return (
    <div className="relative flex flex-wrap items-center gap-2">
      <span id={`${ids}-label`} className="text-muted">
        {t.packages.scope}
      </span>
      {/* On a phone the menu spans the whole bar; from sm up it hangs under the button. */}
      <div ref={box} className="min-w-0 sm:relative">
        <Trigger
          ids={ids}
          current={info ? choiceOf(info) : whole}
          open={picker.open}
          buttonRef={trigger}
          onToggle={toggle}
        />
        {picker.open && (
          <Menu
            ids={ids}
            words={t.packages}
            query={query}
            onQuery={(value) => {
              setQuery(value)
              picker.setActive(0)
            }}
            onKey={picker.onKey}
            choices={choices}
            groups={groups}
            selected={info?.dir ?? null}
            active={picker.active}
            onActive={picker.setActive}
            onPick={picker.pick}
          />
        )}
      </div>
      {info && (
        <Link to={scoped(null)} className="text-accent hover:underline">
          {t.packages.back}
        </Link>
      )}
    </div>
  )
}
