import PrimaryLayout from '@/components/Layout/PrimaryLayout'
import MyList from '@/components/MyList/MyList'
import React from 'react'

export const metadata = {
    title: "My List",
}
const page = () => {
    return (
        <PrimaryLayout>
            <MyList />
        </PrimaryLayout>
    )
}

export default page
