import PrimaryLayout from '@/components/Layout/PrimaryLayout'
import Services from '@/components/Services/Services'
import React from 'react'

export const metadata = {
  title: "Services",
}
const page = () => {
  return (
    <PrimaryLayout>
      <Services />
    </PrimaryLayout>
  )
}

export default page