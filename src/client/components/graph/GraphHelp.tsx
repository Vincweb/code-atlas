import { useGraphWords } from './words'

const Sample = ({ className, dashed = false }: { className: string; dashed?: boolean }) => (
  <svg width="26" height="8" aria-hidden="true">
    <line
      x1="1"
      y1="4"
      x2="25"
      y2="4"
      strokeWidth="2.5"
      strokeDasharray={dashed ? '4 3' : undefined}
      className={className}
    />
  </svg>
)

export const Legend = () => {
  const words = useGraphWords()
  const items: [string, boolean, string][] = [
    ['stroke-edge-red', false, words.legend.red],
    ['stroke-edge-amber', false, words.legend.amber],
    ['stroke-edge-grey', false, words.legend.grey],
    ['stroke-edge-grey', true, words.legend.light],
  ]
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-[12px] text-muted">
      {items.map(([className, dashed, label]) => (
        <span key={label} className="flex items-center gap-1.5">
          <Sample className={className} dashed={dashed} />
          {label}
        </span>
      ))}
      <span className="flex items-center gap-1.5">
        <span className="size-2.5 rounded-full bg-edge-red" aria-hidden="true" />
        {words.legend.flagged}
      </span>
    </div>
  )
}

export const GraphHelp = ({ byDepth }: { byDepth: boolean }) => {
  const words = useGraphWords()
  return (
    <section className="grid grid-cols-1 gap-x-8 gap-y-3 rounded-xl border border-line bg-panel p-4 text-[13px] leading-relaxed sm:grid-cols-2">
      {[...words.help, byDepth ? words.helpDepth : words.helpLayers].map(([title, text]) => (
        <div key={title}>
          <h3 className="font-semibold">{title}</h3>
          <p className="text-muted">{text}</p>
        </div>
      ))}
    </section>
  )
}
