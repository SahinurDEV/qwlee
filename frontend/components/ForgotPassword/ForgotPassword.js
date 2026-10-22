"use client";
import { Form, Input } from "antd";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { usePostForgotPasswordMutation } from "@/app/redux/features/postForgotPasswordApi";
import Button from "../CustomCreate/Button";
import AuthCard from "../common/AuthCard";

const ForgotPassword = () => {
  const [setForgotData, { isLoading }] = usePostForgotPasswordMutation();
  const router = useRouter();

  const onFinish = async (values) => {
    try {
      const response = await setForgotData(values);
      if (response?.error) {
        toast.error(response?.error?.data?.message);
      }
      if (response?.data?.code === 200) {
        toast.success("If that email exists, we've sent a verification code.");
        router.push(`/verify-email?email=${encodeURIComponent(values.email)}`);
      }
    } catch (error) {
      toast.error(error?.message);
    }
  };

  return (
    <AuthCard
      title="Reset your password"
      subtitle="Enter the email tied to your Qwlee account. We'll send a one-time code."
      back={{ href: "/sign-in", label: "Back to sign in" }}
    >
      <Form layout="vertical" onFinish={onFinish}>
        <Form.Item
          name="email"
          label="Email"
          rules={[
            { required: true, message: "Please enter your email" },
            { type: "email", message: "That doesn't look like an email" },
          ]}
        >
          <Input type="email" inputMode="email" autoComplete="email" placeholder="you@example.com" size="large" />
        </Form.Item>
        <Button loading={isLoading} name={"Send code"} />
      </Form>
    </AuthCard>
  );
};

export default ForgotPassword;
