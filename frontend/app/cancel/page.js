import PrimaryLayout from "@/components/Layout/PrimaryLayout";
import Image from "next/image";
import Link from "next/link";
import cancelImage from '@/assest/payment/cancel.gif'

export const metadata = {
  title: "Cancel Payment",
  description: "Cancel Payment",
}
const page = () => {
  return (
    <PrimaryLayout>
      <div className="w-full h-screen flex flex-col justify-center">
        <Image
          width={200}
          height={200}
          className="w-56 h-56 mx-auto"
          src={cancelImage}
          alt="successPayment"
        />
        <h1 className="text-4xl font-bold text-center my-3">Payment Cancel!</h1>
        <Link
          href="/"
          className="mx-auto"
        >
          <button className="w-32 mx-auto px-5 py-2 bg-rose-500 rounded-xl">
            Go Back
          </button>
        </Link>
      </div>
    </PrimaryLayout>
  );
};

export default page;
