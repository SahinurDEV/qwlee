import FreelancerDetails from '@/components/FreelancerDetails/FreelancerDetails';
import PrimaryLayout from '@/components/Layout/PrimaryLayout';
import React from 'react';

export const metadata = {
    title: "Freelancer Details",
}
const Page = ({searchParams}) => {
    return (
        <div>
            <PrimaryLayout>
            <FreelancerDetails searchParams={searchParams}/>
            </PrimaryLayout>
        </div>
    );
}

export default Page;
