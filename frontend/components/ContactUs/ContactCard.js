import { BsTelephonePlus } from "react-icons/bs";
import { GrLocation } from "react-icons/gr";
import { TfiEmail } from "react-icons/tfi";
<GrLocation />;

function ContactCard() {
  return (
    <div className="container">
      <div className="flex flex-col md:flex-row items-center justify-evenly gap-10 md:gap-0 py-[100px]">
        <div className="flex flex-col items-center gap-2 py-[45px] px-[50px] md:px-[100px] custom-box-shadow rounded-lg">
          <TfiEmail className="w-[60px] h-[60px] text-primary" />
          <h2 className="text-[22px] font-bold">Company Email</h2>
          <p>info@qwlee.com</p>
        </div>
        <div className="flex flex-col items-center gap-2 py-[45px] px-[40px] md:px-[100px] custom-box-shadow rounded-lg">
          <BsTelephonePlus className="w-[60px] h-[60px] text-primary" />
          <h2 className="text-[22px] font-bold">Company Number</h2>
          <p>866-566-0261</p>
        </div>
        <div className="flex flex-col items-center gap-2 py-[45px] px-[40px] md:px-[100px] custom-box-shadow rounded-lg">
          <GrLocation className="w-[60px] h-[60px] text-primary" />
          <h2 className="text-[22px] font-bold">Santa Ana, Illinois </h2>
          <p>2972 Westheimer Rd</p>
        </div>
      </div>
    </div>
  );
}

export default ContactCard;
