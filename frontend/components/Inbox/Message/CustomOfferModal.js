import React, { useEffect } from "react";
import { Modal, Input, Checkbox, Form } from "antd";
import Image from "next/image";
import { imageBaseUrl, imgUrl} from "@/lib/constant";
import CustomDropdown from "./CustomDropdown";

const CustomOfferModal = ({ isOpen, gig, onClose, handleSubmitOffer }) => {
  const [form] = Form.useForm();
  const useMilestones = Form.useWatch("useMilestones", form);
  const milestones = Form.useWatch("milestones", form);
  const milestoneTotal = Math.round((milestones || []).reduce((n, m) => n + (Number(m?.amount) || 0), 0) * 100) / 100;
  // With milestones, the offer price is their total.
  useEffect(() => {
    if (useMilestones) form.setFieldsValue({ price: milestoneTotal || undefined });
  }, [useMilestones, milestoneTotal, form]);

  const handleCheckboxChange = (e) => {
    form.setFieldsValue({ isExpirationTime: e.target.checked });
  };

  const handleOnFinish = ({ useMilestones: on, milestones: list, ...values }) => {
    if (on) {
      values.milestones = (list || []).map((m) => ({ title: String(m.title || "").trim(), amount: Number(m.amount), days: Number(m.days) }));
      values.price = milestoneTotal;
    }
    handleSubmitOffer(values);
    form.resetFields();
  };

  return (
    <Modal
      title={<h1 className="text-xl font-bold">Create a Custom Offer</h1>}
      open={isOpen}
      onCancel={onClose}
      width={700}
      centered
      footer={null}
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleOnFinish}
        initialValues={{
          isExpirationTime: false, // Initial value for the checkbox
          expiration: "1",
          useMilestones: false,
          milestones: [{ title: "", amount: "", days: "" }, { title: "", amount: "", days: "" }],
        }}
        className="space-y-3 mt-4"
      >
        <h4 className="text-xl font-medium">{gig?.title}</h4>
        <div className="flex gap-4 items-start">
          <div className="w-72 h-40 relative">
            <Image
              src={imgUrl(gig?.images[0])}
              fill
              className="rounded absolute"
              alt="gig-image"
            />
          </div>
          <Form.Item
            name="description"
            rules={[{ required: true, message: "Please describe your offer!" }]}
            className="w-full"
          >
            <Input.TextArea rows={6} placeholder="Describe Your Offer" />
          </Form.Item>
        </div>

        <div className="flex justify-between items-center gap-4 bg-gray-100 p-4 rounded">
          <Form.Item
            name="revisionDays"
            label="Revision Days"
            className="w-full"
          >
            <CustomDropdown
              placeholder="Select or add Revision Days"
              initialItems={["1", "2", "3", "4", "unlimited"]}
            />
          </Form.Item>

          <Form.Item
            name="deliveryTime"
            label="Delivery Days"
            rules={[
              { required: true, message: "Please select delivery days!" },
            ]}
            className="w-full"
          >
            <CustomDropdown
              placeholder="Select or add Delivery Days"
              initialItems={["1", "4", "7", "10"]}
            />
          </Form.Item>

          <Form.Item
            name="price"
            label="Price"
            rules={[{ required: true, message: "Please enter a price!" }]}
            className="w-full"
          >
            <Input
              type="number"
              readOnly={!!useMilestones}
              placeholder="Enter your price"
              min={0}
              addonBefore={<span>$</span>}
            />
          </Form.Item>
        </div>

        <div className="bg-gray-100 p-4 rounded">
          <Form.Item name="useMilestones" valuePropName="checked" className="!mb-2">
            <Checkbox>Pay in milestones (the buyer releases each part as you deliver it)</Checkbox>
          </Form.Item>
          {useMilestones && (
            <Form.List name="milestones">
              {(fields, { add, remove }) => (
                <div className="space-y-2">
                  {fields.map((field, i) => (
                    <div key={field.key} className="flex flex-wrap items-start gap-2">
                      <span className="mt-1.5 w-5 text-sm text-gray-500">{i + 1}.</span>
                      <Form.Item name={[field.name, "title"]} rules={[{ required: true, message: "Title" }]} className="!mb-0 flex-1 min-w-[160px]">
                        <Input placeholder="Milestone title" maxLength={80} aria-label={`Milestone ${i + 1} title`} />
                      </Form.Item>
                      <Form.Item name={[field.name, "amount"]} rules={[{ required: true, message: "Amount" }, { validator: (_, v) => (Number(v) >= 5 ? Promise.resolve() : Promise.reject(new Error("Min $5"))) }]} className="!mb-0 w-32">
                        <Input type="number" min={5} addonBefore="$" placeholder="Amount" aria-label={`Milestone ${i + 1} amount`} />
                      </Form.Item>
                      <Form.Item name={[field.name, "days"]} rules={[{ required: true, message: "Days" }]} className="!mb-0 w-24">
                        <Input type="number" min={1} max={365} placeholder="Days" aria-label={`Milestone ${i + 1} days`} />
                      </Form.Item>
                      {fields.length > 2 && (
                        <button type="button" onClick={() => remove(field.name)} className="mt-1.5 text-xs text-rose-600 hover:underline">Remove</button>
                      )}
                    </div>
                  ))}
                  <div className="flex items-center justify-between text-sm">
                    {fields.length < 6 ? (
                      <button type="button" onClick={() => add({ title: "", amount: "", days: "" })} className="text-emerald-700 hover:underline">+ Add milestone</button>
                    ) : <span />}
                    <span className="text-gray-600">Total: ${milestoneTotal.toFixed(2)}</span>
                  </div>
                </div>
              )}
            </Form.List>
          )}
        </div>

        <div className="flex justify-between gap-4 items-center bg-gray-100 p-4 rounded">
          <Form.Item
            name="isExpirationTime"
            valuePropName="checked" // Binds the checked value to the form
          >
            <Checkbox onChange={handleCheckboxChange} className="w-full">
              Offer Expire Time
            </Checkbox>
          </Form.Item>

          <Form.Item name="expiration" className="w-48">
            <CustomDropdown
              placeholder="Select or add Expire Time"
              initialItems={["1", "2", "3", "4"]}
            />
          </Form.Item>
        </div>

        <div className="flex justify-end gap-2">
          <div
            className="px-5 py-1 border border-green-500 rounded bg-white cursor-pointer"
            onClick={onClose}
          >
            Cancel
          </div>
          <button
            className="px-5 py-1 border border-green-500 rounded bg-green-500 text-white"
            type="submit"
          >
            Submit Offer
          </button>
        </div>
      </Form>
    </Modal>
  );
};

export default CustomOfferModal;
