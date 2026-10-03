import { createContext, useContext, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { cx } from '../cx'
import { FileViewer } from './FileViewer'

type Target = { path: string; line: number | null }

type Viewer = { open: (path: string, line: number | null) => void }

const ViewerContext = createContext<Viewer>({ open: () => undefined })

export const useViewer = () => useContext(ViewerContext)

export const ViewerProvider = ({ root, children }: { root: string; children: ReactNode }) => {
  const [target, setTarget] = useState<Target | null>(null)
  const value = useMemo<Viewer>(() => ({ open: (path, line) => setTarget({ path, line }) }), [])
  return (
    <ViewerContext value={value}>
      {children}
      {target && (
        <FileViewer
          key={`${target.path}:${target.line}`}
          root={root}
          path={target.path}
          line={target.line}
          onClose={() => setTarget(null)}
        />
      )}
    </ViewerContext>
  )
}

type FileLinkProps = { file: string; line?: number | null; className?: string }

export const FileLink = ({ file, line, className }: FileLinkProps) => {
  const { open } = useViewer()
  return (
    <button
      type="button"
      onClick={() => open(file, line ?? null)}
      className={cx('font-mono text-[12px] break-all text-accent hover:underline', className)}
    >
      {line ? `${file}:${line}` : file}
    </button>
  )
}
