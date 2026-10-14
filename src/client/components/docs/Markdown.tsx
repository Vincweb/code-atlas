import { useMemo } from 'react'
import Markdown from 'react-markdown'
import type { Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { linkTarget, withoutFrontMatter } from '../../../shared/docs'
import { useT } from '../../i18n'
import { useViewer } from '../viewer'

const EXTERNAL = /^(https?:|mailto:)/i

/**
 * A doc rendered from its Markdown. Raw HTML is dropped, not rendered: the doc comes from the
 * analyzed project, perhaps a cloned one, and this page can run its commands. Images stay
 * unloaded — a remote one would tell its host that the project was opened — and a relative link
 * opens the file it names in the viewer.
 */
export const DocMarkdown = ({ path, text }: { path: string; text: string }) => {
  const t = useT()
  const { open } = useViewer()
  const components = useMemo<Components>(
    () => ({
      a: ({ href, children }) => {
        if (href && EXTERNAL.test(href))
          return (
            <a href={href} target="_blank" rel="noreferrer noopener">
              {children}
            </a>
          )
        const target = href && !href.startsWith('#') ? linkTarget(path, href) : null
        if (!target) return <span>{children}</span>
        return (
          <button type="button" className="atlas-doc-link" onClick={() => open(target, null)}>
            {children}
          </button>
        )
      },
      img: ({ alt }) => <span className="atlas-doc-image">{t.docs.image(alt ?? '')}</span>,
    }),
    [path, open, t],
  )
  return (
    <div className="atlas-doc">
      <Markdown remarkPlugins={[remarkGfm]} skipHtml components={components}>
        {withoutFrontMatter(text)}
      </Markdown>
    </div>
  )
}
