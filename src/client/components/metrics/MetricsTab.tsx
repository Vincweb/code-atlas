import { useMemo } from 'react'
import type { Analysis } from '../../../shared/types'
import { useT } from '../../i18n'
import { Histogram, Tiles, limitOf } from './Charts'
import { FeaturesTable } from './FeaturesTable'
import { Ranking } from './Rankings'

export const MetricsTab = ({ analysis }: { analysis: Analysis }) => {
  const t = useT()
  const words = t.metrics
  const complexityLimit = limitOf(analysis, 'complexity')
  const linesLimit = limitOf(analysis, 'max-lines')

  const functions = useMemo(
    () =>
      [...analysis.functions]
        .sort((a, b) => b.complexity - a.complexity)
        .slice(0, 30)
        .map((fn) => ({
          key: `${fn.file}:${fn.line}`,
          value: fn.complexity,
          title: <span className="font-mono text-[12px]">{fn.name}</span>,
          file: fn.file,
          line: fn.line,
          detail: `${words.paramsCount(fn.params)} · ${words.linesCount(fn.lines)}`,
        })),
    [analysis, words],
  )
  const files = useMemo(
    () =>
      [...analysis.files]
        .sort((a, b) => b.lines - a.lines)
        .slice(0, 20)
        .map((file) => ({
          key: file.path,
          value: file.lines,
          title: <span className="font-mono text-[12px]">{file.path.split('/').pop()}</span>,
          file: file.path,
          line: null,
          detail: file.feature,
        })),
    [analysis],
  )

  return (
    <div className="flex flex-col gap-5 pb-10">
      <p className="max-w-3xl leading-relaxed text-muted">{words.intro}</p>
      <Tiles analysis={analysis} />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Histogram
          title={words.complexityTitle}
          text={words.complexityText}
          distribution={analysis.distribution.complexity}
          limit={complexityLimit}
          count={words.countFunctions}
        />
        <Histogram
          title={words.sizeTitle}
          text={words.sizeText}
          distribution={analysis.distribution.fileLines}
          limit={linesLimit}
          count={words.countFiles}
        />
      </div>
      <FeaturesTable analysis={analysis} />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Ranking
          title={words.topFunctions}
          text={words.topFunctionsText}
          items={functions}
          limit={complexityLimit?.max ?? null}
        />
        <Ranking
          title={words.largestFiles}
          text={words.largestFilesText}
          items={files}
          limit={linesLimit?.max ?? null}
        />
      </div>
    </div>
  )
}
