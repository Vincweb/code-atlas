import type { FeatureEdge } from '../../../shared/types'
import { useT } from '../../i18n'
import { FileLink } from '../viewer'
import { CHIP, TONE } from './edges'
import { cx } from '../../cx'

export const EdgeImports = ({ edge }: { edge: FeatureEdge }) => {
  const t = useT()
  return (
    <li className="rounded border border-line p-2">
      <div className="flex flex-wrap items-center gap-1.5 font-mono text-[12px]">
        <span className="break-all">{edge.from}</span>
        <span>→</span>
        <span className="break-all">{edge.to}</span>
        <span className={cx('rounded border px-1 text-[11px]', CHIP[TONE[edge.class]])}>
          {t.edgeClass[edge.class]} · {edge.weight}
        </span>
      </div>
      <ul className="mt-1 flex flex-col gap-0.5">
        {edge.imports.map((item, index) => (
          <li key={index} className="flex flex-wrap gap-x-1.5">
            <FileLink file={item.file} line={item.line} />
            <span className="font-mono text-[12px] break-all text-muted">→ {item.target}</span>
          </li>
        ))}
      </ul>
    </li>
  )
}
