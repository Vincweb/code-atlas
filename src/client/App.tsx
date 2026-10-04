import { useEffect } from 'react'
import { useT } from './i18n'
import { ProjectPage } from './components/ProjectPage'
import { Welcome } from './components/Welcome'
import { useRoute } from './state/router'

export const App = () => {
  const route = useRoute()
  const t = useT()
  const showProject = route.view === 'project' && route.root !== ''

  useEffect(() => {
    if (!showProject) document.title = t.titles.welcome
  }, [showProject, t])

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [route.view, route.root])

  if (showProject) return <ProjectPage key={route.root} root={route.root} tab={route.tab} />
  return <Welcome />
}
