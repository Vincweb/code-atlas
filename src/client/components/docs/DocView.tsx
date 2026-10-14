import { Suspense, lazy } from 'react'
import { docCandidates } from '../../../shared/docs'
import { projectPath } from '../../../shared/routes'
import type { Analysis } from '../../../shared/types'
import { useT } from '../../i18n'
import { useDoc } from '../../state/queries'
import { navigate } from '../../state/router'
import { ClaudeActions } from '../ClaudeActions'
import { Button, Chip, Code, ErrorBox, Spinner } from '../ui'
import { FileLink } from '../viewer'
import { describesItself, draftFacts } from './model'
import type { Entry } from './model'

// The Markdown renderer is the largest part of the tab: it loads with the first doc opened.
const DocMarkdown = lazy(() =>
  import('./Markdown').then((module) => ({ default: module.DocMarkdown })),
)

const Loading = () => {
  const t = useT()
  return (
    <p role="status" className="flex items-center gap-2 text-muted">
      <Spinner /> {t.common.loading}
    </p>
  )
}

/** The doc as written; its front matter's description leads, since the body leaves it out. */
const DocBody = ({
  root,
  id,
  path,
  description,
}: {
  root: string
  id: string
  path: string
  description: string | null
}) => {
  const t = useT()
  const query = useDoc(root, id, path)
  if (query.isPending) return <Loading />
  if (!query.data)
    return <ErrorBox message={t.docs.loadFailed} onRetry={() => void query.refetch()} />
  const { text } = query.data
  return (
    <>
      {description && describesItself(text) && (
        <p className="max-w-3xl text-[15px] leading-relaxed">{description}</p>
      )}
      <Suspense fallback={<Loading />}>
        <DocMarkdown path={query.data.path} text={text} />
      </Suspense>
    </>
  )
}

/** Where the doc was looked for, how to start it, and Claude Code to draft it from the code. */
const Missing = ({
  analysis,
  id,
  root,
  packagesView,
}: {
  analysis: Analysis
  id: string
  root: string
  packagesView: boolean
}) => {
  const t = useT()
  const words = t.docs.empty
  const candidates = docCandidates(id, analysis.config.docs)
  const facts = draftFacts(analysis, id, candidates[0] ?? `${id}/README.md`, packagesView)
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-dashed border-line bg-bg p-4">
      <h3 className="text-[14px] font-semibold">{words.title}</h3>
      <div className="flex flex-col gap-1.5">
        <p className="text-muted">{words.lookedFor}</p>
        <ol className="flex flex-wrap gap-1.5">
          {candidates.map((candidate) => (
            <li key={candidate}>
              <Chip>{candidate}</Chip>
            </li>
          ))}
        </ol>
      </div>
      <p className="max-w-3xl text-muted">{words.frontMatter}</p>
      <Code text={t.docs.frontMatterExample} className="w-fit max-w-full" />
      <p className="text-muted">{words.claude}</p>
      <ClaudeActions prompt={t.docs.draftPrompt(facts)} cwd={root} primary />
    </section>
  )
}

/** One feature: what code-atlas measured of it, then what its doc says. */
export const DocView = ({
  analysis,
  entry,
  root,
  packagesView,
}: {
  analysis: Analysis
  entry: Entry
  root: string
  packagesView: boolean
}) => {
  const t = useT()
  const words = t.docs
  const { node, doc } = entry
  const layer = node.layer === null ? null : (analysis.graph.layers[node.layer]?.name ?? null)
  const facts = [
    words.files(node.files),
    words.lines(node.lines.toLocaleString(t.locale)),
    words.usedBy(node.ca),
    words.dependsOn(node.ce),
  ]
  return (
    <article className="flex min-w-0 flex-col gap-4 rounded-2xl border border-line bg-panel p-5">
      <header className="flex flex-col gap-2 border-b border-line pb-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-mono text-[15px] font-semibold break-all">{node.id}</h2>
          {layer && <Chip>{layer}</Chip>}
          {doc?.status && (
            <Chip className="border-accent/40 text-accent">
              {words.status} · {doc.status}
            </Chip>
          )}
          {doc?.owner && (
            <Chip>
              {words.owner} · {doc.owner}
            </Chip>
          )}
        </div>
        <p className="text-[12px] text-muted">{facts.join(' · ')}</p>
        <div className="flex flex-wrap items-center gap-3">
          {doc?.path && <FileLink file={doc.path} />}
          {packagesView && (
            <Button onClick={() => navigate(projectPath(root, 'docs', null, node.id))}>
              {words.openPackage} →
            </Button>
          )}
        </div>
      </header>
      {doc?.path ? (
        <DocBody root={root} id={node.id} path={doc.path} description={doc.description} />
      ) : (
        <Missing analysis={analysis} id={node.id} root={root} packagesView={packagesView} />
      )}
    </article>
  )
}
