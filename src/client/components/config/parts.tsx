import type { ReactNode } from 'react'
import { cx } from '../../util/cx'
import { useT } from '../../i18n'

export const Section = ({
  id,
  title,
  text,
  aside,
  children,
}: {
  id: string
  title: string
  text: string
  aside?: ReactNode
  children: ReactNode
}) => (
  <section
    id={id}
    className="flex scroll-mt-6 flex-col gap-3 rounded-2xl border border-line bg-panel p-5"
  >
    <header className="flex flex-wrap items-start gap-3">
      <div className="min-w-0 flex-1">
        <h2 className="text-[16px] font-semibold tracking-tight">{title}</h2>
        {text && <p className="max-w-3xl leading-relaxed text-muted">{text}</p>}
      </div>
      {aside}
    </header>
    {children}
  </section>
)

export const Chip = ({ children, className }: { children: ReactNode; className?: string }) => (
  <span
    className={cx(
      'inline-flex items-center rounded-md border border-line bg-bg px-2 py-0.5 font-mono text-[12px]',
      className,
    )}
  >
    {children}
  </span>
)

export const Code = ({ text, className }: { text: string; className?: string }) => (
  <pre
    className={cx(
      'max-h-[32rem] overflow-auto rounded-xl border border-line bg-code-bg p-4 font-mono text-[12px] leading-5',
      className,
    )}
  >
    {text}
  </pre>
)

export type StackLayer = { name: string; siblings: boolean; features: string[] }

const sharedParent = (ids: string[]) => {
  const parents = ids.map((id) => id.split('/').slice(0, -1))
  const first = parents[0] ?? []
  let length = 0
  while (length < first.length && parents.every((parent) => parent[length] === first[length]))
    length++
  return first.slice(0, length).join('/')
}

const short = (id: string, parent: string) =>
  parent && id.startsWith(`${parent}/`) ? id.slice(parent.length + 1) : id

export const LayerStack = ({
  layers,
  unlayered,
  compact = false,
}: {
  layers: StackLayer[]
  unlayered: string[]
  compact?: boolean
}) => {
  const t = useT()
  const all = unlayered.length
    ? [...layers, { name: t.configHelp.layers.unlayered, siblings: false, features: unlayered }]
    : layers
  return (
    <ol
      className={cx(compact ? 'grid gap-2 sm:grid-cols-2 xl:grid-cols-3' : 'flex flex-col gap-2')}
    >
      {all.map((layer, index) => {
        const parent = sharedParent(layer.features)
        const isUnlayered = unlayered.length > 0 && index === all.length - 1
        return (
          <li
            key={`${layer.name}-${index}`}
            className={cx(
              'flex flex-col gap-2 rounded-xl border',
              compact ? 'px-3 py-2' : 'px-4 py-3',
              isUnlayered ? 'border-dashed border-line' : 'border-line bg-bg',
            )}
          >
            <div className="flex flex-wrap items-center gap-2">
              {!isUnlayered && (
                <span className="flex size-6 items-center justify-center rounded-full bg-accent/10 text-[12px] font-semibold text-accent">
                  {index + 1}
                </span>
              )}
              <span className="font-semibold">{layer.name}</span>
              {layer.siblings && (
                <span className="rounded-full border border-edge-amber px-2 text-[11px] text-edge-amber">
                  {t.configHelp.layers.siblings}
                </span>
              )}
              {!isUnlayered && index === 0 && (
                <span className="text-[11px] text-muted">· {t.configHelp.layers.top}</span>
              )}
              {!isUnlayered && index === layers.length - 1 && layers.length > 1 && (
                <span className="text-[11px] text-muted">· {t.configHelp.layers.bottom}</span>
              )}
              <span className="ml-auto text-[11px] text-muted">
                {t.configHelp.features.count(layer.features.length)}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {layer.features.map((id) => (
                <Chip key={id}>
                  <span title={id}>{short(id, parent)}</span>
                </Chip>
              ))}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
