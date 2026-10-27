"use client";
import Image from "next/image";
import noInbox from "../../../assest/image/noinbox.png";

// Shown on /inbox when no chatId is selected. Copy is "pick a thread"
// (not "fresh inbox") so it stays correct when the sidebar already has chats.
const Blank = () => {
  return (
    <div className="bg-[#f5f5f5] w-full h-full flex justify-center items-center rounded-xl">
      <div className="text-center px-6">
        <Image
          className="mx-auto"
          width={160}
          height={160}
          src={noInbox}
          alt=""
        />
        <h1 className="text-2xl font-bold mt-4 text-gray-900">Select a conversation</h1>
        <p className="text-base text-gray-500 mt-2 max-w-sm mx-auto">
          Choose a chat from the list to read and reply. New conversations appear here when you message a seller or buyer.
        </p>
      </div>
    </div>
  );
};

export default Blank;
