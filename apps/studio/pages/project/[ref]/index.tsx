import { useFlag, useParams } from 'common'
import { Home } from 'components/interfaces/Home/Home'
import { HomeV2 } from 'components/interfaces/HomeNew/Home'
import DefaultLayout from 'components/layouts/DefaultLayout'
import { ProjectLayoutWithAuth } from 'components/layouts/ProjectLayout'
import { usePHFlag } from 'hooks/ui/useFlag'
import type { NextPageWithLayout } from 'types'
import { useRouter } from 'next/router'
import { useEffect } from 'react'

const HomePage: NextPageWithLayout = () => {
  const { ref } = useParams()
  const router = useRouter()
  const isHomeNew = useFlag('homeNew')
  const isHomeNewPH = usePHFlag('homeNew')

  // Redirect if accessing /project/default
  useEffect(() => {
    if (ref === 'default') {
      console.warn('[Project Page] Redirecting from /project/default to home')
      router.push('/')
    }
  }, [ref, router])

  // Return null while redirecting
  if (ref === 'default') {
    return null
  }

  if (isHomeNew && isHomeNewPH) {
    return <HomeV2 />
  }
  return <Home />
}

HomePage.getLayout = (page) => (
  <DefaultLayout>
    <ProjectLayoutWithAuth>{page}</ProjectLayoutWithAuth>
  </DefaultLayout>
)

export default HomePage
