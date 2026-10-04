import { useT } from '../i18n'
import { useProjects } from '../state/queries'
import { Prefs } from './Prefs'
import { Hero } from './welcome/Hero'
import { Mark } from './welcome/Mark'
import { Features, Steps, Trust } from './welcome/Pitch'
import { ProjectPicker } from './welcome/ProjectPicker'

export const Welcome = () => {
  const t = useT()
  const projects = useProjects()
  const data = projects.data
  const openPicker = () =>
    document.getElementById('open')?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-5 sm:px-8">
      <header className="flex items-center gap-3 py-5">
        <Mark className="size-8" />
        <span className="text-[16px] font-semibold tracking-tight">code-atlas</span>
        <span className="ml-auto flex items-center gap-3 text-muted">
          {data && <span className="hidden sm:inline">v{data.version}</span>}
          <Prefs />
        </span>
      </header>

      <Hero onOpen={openPicker} />
      <ProjectPicker
        data={data}
        pending={projects.isPending}
        error={projects.error}
        onRetry={() => void projects.refetch()}
      />
      <Features />
      <Steps />
      <Trust />

      <footer className="mt-auto flex flex-col items-center gap-2 border-t border-line py-8 text-center text-muted">
        <span className="flex items-center gap-2 text-text">
          <Mark className="size-6" />
          <span className="font-semibold">code-atlas</span>
          {data && <span className="text-muted">v{data.version}</span>}
        </span>
        <p className="max-w-md text-[12px] leading-relaxed">{t.welcome.localOnly}</p>
        <p className="text-[11px]">{t.welcome.madeFor}</p>
      </footer>
    </div>
  )
}
