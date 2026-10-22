"use client";
import { logout } from "@/actions/auth.services";
import { useGetUserQuery } from "@/app/redux/features/getSingleUserApi";
import { setUser } from "@/app/redux/slices/userSlice";
import useUser from "@/hooks/useUser";
import baseURL from "@/lib/config";
import { imageBaseUrl, imgUrl} from "@/lib/constant";
import { Dropdown, Form, Input, Select } from "antd";
import Cookies from "js-cookie";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { FaUserLarge } from "react-icons/fa6";
import { HiOutlineMenu } from "react-icons/hi";
import { IoMdHeartEmpty } from "react-icons/io";
import {
  IoChevronDown,
  IoChevronUp,
  IoNotificationsOutline,
  IoSearch,
} from "react-icons/io5";
import { MdOutlineEmail } from "react-icons/md";
import { useDispatch } from "react-redux";
import { toast } from "sonner";
import MobileDrawer from "./MobileDrawer";
import { useGetNotificationQuery } from "@/app/redux/features/getNotificationApi";

import orderImage from "@/public/icons/order.png";
import deliveredImage from "@/public/icons/delivered.png";

export const Navbar = () => {
  const user = useUser();
  const { data: userData } = useGetUserQuery(user?.id, {
    skip: !user?.id,
  });

  const userTransformData = userData?.data?.attributes?.user;
  const { data: notificationData } = useGetNotificationQuery(undefined, {
    skip: !user,
  });
  const [selected, setSelected] = useState("Gig");
  const [isOpen, setIsOpen] = useState(false);
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const [isLogin, setIsLogin] = useState(true);
  const dispatch = useDispatch();
  const dropdownRef = useRef(null);

  const [unRead, setUnRead] = useState(notificationData?.unReadCount);
  useEffect(() => {
    const fetchData = async () => {
      const user = Cookies.get("user");
      if (user && JSON.parse(user)?.id) {
        const res = await baseURL.get(`/users/${JSON.parse(user)?.id}`);
        if (res?.data?.code === 200) {
          dispatch(setUser(res?.data?.data?.attributes?.user));
        }
      }
    };

    fetchData();
  }, [dispatch]);

  useEffect(() => {
    setUnRead(notificationData?.unReadCount);
  }, [notificationData]);
  // Handle clicks outside the dropdown
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false); // Close dropdown if clicked outside
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [dropdownRef]);
  const showDrawer = () => {
    setOpen(true);
  };
  const onClose = () => {
    setOpen(false);
  };

  const profileLinks = [
    {
      key: "1",
      label: (
        <div
          onClick={() => {
            router.push("/profile");
          }}
          className="px-4 py-2 transition-colors duration-200 hover:text-primary text-[15px] cursor-pointer font-medium"
        >
          Profile
        </div>
      ),
    },
    {
      key: "2",
      label: (
        <div
          onClick={() => {
            router.push("/dashboard");
          }}
          className="px-4 py-2 transition-colors duration-200 hover:text-primary text-[15px] cursor-pointer font-medium"
        >
          Dashboard
        </div>
      ),
    },
    {
      key: "3",
      label: (
        <div
          onClick={() => {
            router.push("/inbox");
          }}
          className="px-4 py-2 transition-colors duration-200 hover:text-primary text-[15px] cursor-pointer font-medium"
        >
          Inbox
        </div>
      ),
    },
    {
      key: "4",
      label: (
        <div
          onClick={() => {
            router.push("/order");
          }}
          className="px-4 py-2 transition-colors duration-200 hover:text-primary text-[15px] cursor-pointer font-medium"
        >
          Order
        </div>
      ),
    },
    {
      key: "req",
      label: (
        <div
          onClick={() => {
            router.push(user?.role === "freelancer" ? "/requests" : "/requests/mine");
          }}
          className="px-4 py-2 transition-colors duration-200 hover:text-primary text-[15px] cursor-pointer font-medium"
        >
          {user?.role === "freelancer" ? "Buyer requests" : "My requests"}
        </div>
      ),
    },
    user &&
      user?.role === "freelancer" && {
        key: "5",
        label: (
          <div
            onClick={() => {
              router.push("/earnings");
            }}
            className="px-4 py-2 transition-colors duration-200 hover:text-primary text-[15px] cursor-pointer font-medium"
          >
            Earnings
          </div>
        ),
      },
    {
      key: "6",
      label: (
        <div
          onClick={() => handleLogout()}
          className="px-4 py-2 transition-colors duration-200 hover:text-primary text-[15px] cursor-pointer font-medium"
        >
          Logout
        </div>
      ),
    },
  ];

  const handleLogout = () => {
    const refreshToken = Cookies.get("refreshToken");

    logout(refreshToken)
      .then((res) => {
        toast.success("Logout Successfully");
        localStorage.removeItem("accessToken");
        Cookies.remove("user");
        Cookies.remove("accessToken");
        Cookies.remove("refreshToken");
        dispatch(setUser(null));
        router.push("/sign-in");
      })
      .catch((error) => {
        toast.error(error.message || "Logout failed");
      });
    setIsLogin(false);
  };
  const handleSearch = (e) => {
    e.preventDefault();
    const form = e.target;
    const title = form.title.value;
    if (title && selected === "Freelancer") {
      router.push(`/hire-freelancers?name=${title}`);
      form.reset();
    }
    if (title && selected === "Gig") {
      router.push(`/gig?title=${title}`);
      form.reset();
    }
  };

  const handleSelect = (option) => {
    setSelected(option);
    setIsOpen(false);
  };

  const notificationItems = notificationData?.results?.map((item) => ({
    key: item._id,
    label: (
      <div className="p-2 cursor-pointer flex items-center gap-2">
        {item.type === "order" ? (
          <Image width={20} height={20} src={orderImage} alt="orderImage" />
        ) : (
          <Image width={20} height={20} src={deliveredImage} alt="orderImage" />
        )}
        <p className="text-sm">{item.message}</p>
      </div>
    ),
  }));
  return (
    <div>
      {/* mobile menu */}
      <div className="flex md:hidden bg-primary justify-between items-center px-[10px] py-[18px]">
        <div>
          <Link href="/">
            <Image
              src="/qwlee-logo-white.svg"
              width={150}
              height={80}
              className="w-full"
              alt=" logo"
            />
          </Link>
        </div>
        <div className="flex items-center justify-center space-x-3 text-white">
          <IoSearch className="w-[20px] h-[20px] cursor-pointer" />
          {/* <GrLocation className="w-[20px] h-[20px] cursor-pointer" /> */}
          <HiOutlineMenu
            onClick={showDrawer}
            className="w-[20px] h-[20px] cursor-pointer"
          />
        </div>
      </div>

      {/* desktop menu */}
      <div className="hidden md:flex bg-primary px-[10px] py-[24px]">
        <div className="container flex items-center justify-between ">
          <div className="flex items-center justify-center space-x-4">
            <Link href="/">
              <Image
                src="/qwlee-logo-white.svg"
                width={200}
                height={80}
                className="cursor-pointer"
                alt="logo"
              />
            </Link>
            <div className="flex items-center space-x-2 cursor-pointer">
              {/* <div className="p-2 bg-white rounded-full ">
                <GrLocation className="w-[20px]  text-primary h-[20px]" />
              </div>
              <p className="text-[16px] text-white">{address ? address : 'Set Location'}</p> */}
            </div>
          </div>
          <div>
            {user ? (
              <div className="flex gap-4">
                <div className="flex items-center justify-center cursor-pointer gap-3 px-2 py-1 bg-white rounded-lg shadow-lg">
                  <form
                    onSubmit={handleSearch}
                    className="flex items-center space-x-2"
                  >
                    <div
                      className="relative flex items-center"
                      ref={dropdownRef}
                    >
                      {/* Selected option with toggle arrow */}
                      <ul
                        className="w-[110px] p-1 cursor-pointer flex justify-between items-center"
                        onClick={() => setIsOpen(!isOpen)} // Toggle dropdown
                      >
                        <li>{selected}</li>
                        {isOpen ? (
                          <IoChevronUp className="w-4 h-4 text-gray-600" />
                        ) : (
                          <IoChevronDown className="w-4 h-4 text-gray-600" />
                        )}
                      </ul>

                      {/* Dropdown options */}
                      {isOpen && (
                        <ul className="absolute left-0 -ml-2 mt-2 top-8 w-[120px] px-1 py-2 bg-gray-200 rounded z-50">
                          <li
                            className="px-3 py-1 hover:bg-white rounded cursor-pointer"
                            onClick={() => handleSelect("Gig")}
                          >
                            Gig
                          </li>
                          <li
                            className="px-3 py-1 hover:bg-white  rounded  cursor-pointer"
                            onClick={() => handleSelect("Freelancer")}
                          >
                            Freelancer
                          </li>
                        </ul>
                      )}
                    </div>

                    <input
                      type="text"
                      name="title"
                      className="w-36 p-2 rounded-md text-sm outline-none"
                      placeholder="Search gig or freelancer..."
                    />
                    <button
                      type="submit"
                      className="p-2 rounded-full bg-primary hover:bg-primary-dark transition-colors duration-300"
                    >
                      <IoSearch className="w-5 h-5 text-white" />
                    </button>
                  </form>
                </div>
                <div className="flex items-center justify-center gap-4">
                  {user && user?.role === "buyer" && (
                    <div className="p-2 bg-white cursor-pointer rounded-full ">
                      <Link href="/list">
                        <IoMdHeartEmpty className="size-5 text-primary" />
                      </Link>
                    </div>
                  )}
                  <div className="p-2 bg-white cursor-pointer rounded-full ">
                    <Link href="/inbox">
                      <MdOutlineEmail className="size-5 text-primary" />
                    </Link>
                  </div>
                  <Dropdown
                    overlayClassName="custom-dropdown"
                    overlayStyle={{
                      borderRadius: "12px",
                      boxShadow: "0px 8px 16px rgba(0, 0, 0, 0.1)",
                    }}
                    menu={{
                      items: notificationItems,
                    }}
                    placement="bottomRight"
                    arrow
                  >
                    {/* Wrapping the two divs inside a single container */}
                    <div className="relative">
                      <div className="p-2 bg-white cursor-pointer rounded-full relative">
                        <IoNotificationsOutline className="size-5 text-primary" />
                        <span className="absolute top-0 right-0 bg-red-500 text-white text-xs w-4 h-4 rounded-full flex items-center justify-center">
                          {unRead || 0}
                        </span>
                      </div>
                    </div>
                  </Dropdown>
                </div>
                <div className="flex items-center justify-center gap-4 cursor-pointer">
                  {user && user?.role === "freelancer" && (
                    <p className="text-white text-[17px] font-bold ">
                      ${userTransformData?.balance}
                    </p>
                  )}
                  <Dropdown
                    menu={{
                      items: profileLinks,
                    }}
                    placement="bottomRight"
                    arrow
                  >
                    <div onClick={(e) => e.preventDefault()}>
                      <div className="p-1 rounded-full bg-secondary ">
                        <Image
                          src={imgUrl(user?.image)}
                          width={50}
                          height={50}
                          alt="gig"
                          className="w-[35px] h-[35px] rounded-full"
                        />
                      </div>
                    </div>
                  </Dropdown>
                </div>
              </div>
            ) : (
              <Link href="/sign-in">
                <div className="flex items-center justify-center gap-4 cursor-pointer">
                  <p className="text-white text-[16px] ">Welcome! Log in or Sign up</p>
                  <div className="p-2 bg-white rounded-full ">
                    <FaUserLarge className="w-[20px]  text-primary h-[20px]" />
                  </div>
                </div>
              </Link>
            )}
          </div>
        </div>
      </div>

      <MobileDrawer
        open={open}
        onClose={onClose}
        setOpen={setOpen}
        showDrawer={showDrawer}
        user={user}
      />
    </div>
  );
};

export default Navbar;
