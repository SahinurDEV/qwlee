import PrimaryLayout from "@/components/Layout/PrimaryLayout";
import Image from "next/image";
import successImage from '@/assest/payment/success.gif'

export const metadata = {
    title: "Success Payment",
    description: "Success Payment",
}
const page = () => {
    return (
        <PrimaryLayout>
            <div className="w-full h-screen flex flex-col justify-center">
                <Image
                    width={200}
                    height={200}
                    className="w-56 h-56 mx-auto"
                    src={successImage}
                    alt="successPayment"
                />
                <h1 className="text-4xl font-bold text-center mt-10">Payment Successful!</h1>
            </div>
        </PrimaryLayout>
    );
};

export default page;
