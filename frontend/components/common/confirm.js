"use client";
// confirmModal — Fiverr-style confirmation dialog used in place of
// sweetalert2 across the marketplace. Returns a Promise<boolean>:
// `true` if the user clicks the confirm button, `false` on cancel /
// dismiss. Built on antd's Modal.confirm so we don't add a new dep.

import { Modal } from "antd";

export function confirmModal({
  title,
  description,
  confirmText = "Confirm",
  cancelText = "Cancel",
  danger = false,
} = {}) {
  return new Promise((resolve) => {
    Modal.confirm({
      title,
      content: description,
      okText: confirmText,
      okType: danger ? "danger" : "primary",
      okButtonProps: danger
        ? undefined
        : { style: { backgroundColor: "#059669", borderColor: "#059669" } },
      cancelText,
      centered: true,
      maskClosable: true,
      onOk: () => resolve(true),
      onCancel: () => resolve(false),
    });
  });
}
