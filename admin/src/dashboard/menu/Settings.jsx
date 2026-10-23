// Platform Settings — tabbed page covering account links, payment
// providers (built-in + custom), SMTP server config, legal policies,
// and misc free-form key/value bag. Every section reads from + writes
// to /v1/admin/settings (no more "edit the .env" deploys).

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import {
  IoChevronForward,
  IoCardOutline,
  IoMailOutline,
  IoSettingsOutline,
  IoAddCircleOutline,
  IoTrashOutline,
  IoCheckmarkCircle,
  IoCloseCircle,
} from "react-icons/io5";
import { LuShield, LuFileText, LuLock, LuUser, LuBadgeCheck } from "react-icons/lu";

import {
  useGetSettingsQuery,
  useUpdateSettingsMutation,
  useAddCustomPaymentMutation,
  useRemoveCustomPaymentMutation,
  useSendTestEmailMutation,
} from "../../redux/api/apiSlice";

import PageHeader from "../../common/PageHeader";
import Card from "../../common/Card";
import cls from "../../utils/cls";

const TABS = [
  { id: "payments", label: "Payment methods", icon: IoCardOutline },
  { id: "custom", label: "Custom providers", icon: IoAddCircleOutline },
  { id: "smtp", label: "SMTP server", icon: IoMailOutline },
  { id: "misc", label: "Misc", icon: IoSettingsOutline },
  { id: "account", label: "Account & policies", icon: LuShield },
];

// Each built-in provider declares the credential fields the admin must
// fill in. Keeps the form code generic — adding a new provider only
// needs an entry here + a backend handler.
const PROVIDERS = [
  {
    id: "stripe",
    name: "Stripe",
    blurb: "Cards, Apple Pay, Google Pay via Stripe Checkout.",
    fields: [
      { key: "publishableKey", label: "Publishable key", placeholder: "pk_live_… / pk_test_…" },
      { key: "secretKey", label: "Secret key", placeholder: "sk_live_… / sk_test_…", secret: true },
      { key: "webhookSecret", label: "Webhook signing secret", placeholder: "whsec_…", secret: true },
    ],
  },
  {
    id: "paypal",
    name: "PayPal",
    blurb: "PayPal balance, cards, BNPL via PayPal Orders API.",
    fields: [
      { key: "clientId", label: "Client ID" },
      { key: "clientSecret", label: "Client Secret", secret: true },
    ],
  },
  {
    id: "paddle",
    name: "Paddle",
    blurb: "Paddle hosted checkout (Merchant of Record).",
    fields: [
      { key: "apiKey", label: "API key", secret: true },
      { key: "priceIdFallback", label: "Default price ID", placeholder: "pri_…" },
    ],
  },
  {
    id: "lemonsqueezy",
    name: "Lemon Squeezy",
    blurb: "Lemon Squeezy custom checkout (MoR for SaaS / digital).",
    fields: [
      { key: "apiKey", label: "API key", secret: true },
      { key: "storeId", label: "Store ID" },
      { key: "variantId", label: "Variant ID" },
    ],
  },
  {
    id: "sslcommerz",
    name: "SSLCommerz (Bangladesh)",
    blurb: "bKash, Nagad, Rocket, cards — popular for BD payments.",
    fields: [
      { key: "storeId", label: "Store ID" },
      { key: "storePassword", label: "Store password", secret: true },
    ],
  },
];

export default function Settings() {
  const [tab, setTab] = useState("payments");
  const { data: config, isFetching } = useGetSettingsQuery();

  return (
    <div>
      <PageHeader
        title="Platform settings"
        subtitle="Payment provider credentials, SMTP server, and misc platform configuration."
      />

      <div className="flex flex-wrap gap-2 mb-5">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cls(
              "inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full border text-sm font-medium transition",
              tab === t.id
                ? "bg-primary-50 border-primary-300 text-primary-800"
                : "bg-white border-ink-200 text-ink-700 hover:border-ink-300"
            )}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {isFetching && !config ? (
        <div className="py-16 text-center text-ink-500 text-sm">Loading…</div>
      ) : tab === "payments" ? (
        <PaymentsTab config={config} />
      ) : tab === "custom" ? (
        <CustomProvidersTab config={config} />
      ) : tab === "smtp" ? (
        <SmtpTab config={config} />
      ) : tab === "misc" ? (
        <MiscTab config={config} />
      ) : (
        <AccountTab />
      )}
    </div>
  );
}

// --- Payments tab ---------------------------------------------------------
function PaymentsTab({ config }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {PROVIDERS.map((p) => (
        <ProviderCard
          key={p.id}
          provider={p}
          value={config?.payments?.[p.id] || { enabled: false, mode: "test", credentials: {} }}
        />
      ))}
    </div>
  );
}

function ProviderCard({ provider, value }) {
  const [enabled, setEnabled] = useState(!!value.enabled);
  const [mode, setMode] = useState(value.mode || "test");
  const [creds, setCreds] = useState({ ...(value.credentials || {}) });
  const [updateSettings, { isLoading }] = useUpdateSettingsMutation();

  useEffect(() => {
    setEnabled(!!value.enabled);
    setMode(value.mode || "test");
    setCreds({ ...(value.credentials || {}) });
  }, [value]);

  async function handleSave() {
    const res = await updateSettings({
      payments: {
        [provider.id]: {
          enabled,
          mode,
          credentials: creds,
        },
      },
    });
    if (res?.error) {
      toast.error(res.error?.data?.message || "Could not save");
      return;
    }
    toast.success(`${provider.name} settings saved`);
  }

  return (
    <Card className="p-5">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary-50 text-primary-700 flex items-center justify-center shrink-0">
          <IoCardOutline className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-base font-semibold text-ink-900">{provider.name}</h3>
            <Toggle checked={enabled} onChange={setEnabled} />
          </div>
          <p className="text-xs text-ink-500 mt-0.5">{provider.blurb}</p>
        </div>
      </div>

      <div className="mt-4">
        <div className="text-xs font-semibold text-ink-500 uppercase tracking-wide mb-1.5">
          Mode
        </div>
        <div className="inline-flex rounded-lg border border-ink-200 overflow-hidden">
          {["test", "live"].map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={cls(
                "px-3 py-1.5 text-xs font-medium",
                mode === m ? "bg-primary-600 text-white" : "bg-white text-ink-600 hover:bg-ink-50"
              )}
            >
              {m === "test" ? "Test / sandbox" : "Live"}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {provider.fields.map((f) => (
          <CredField
            key={f.key}
            label={f.label}
            placeholder={f.placeholder}
            secret={f.secret}
            value={creds[f.key] || ""}
            onChange={(v) => setCreds((c) => ({ ...c, [f.key]: v }))}
          />
        ))}
      </div>

      <div className="flex items-center justify-between mt-5 pt-4 border-t border-ink-100">
        <Status enabled={enabled} ready={provider.fields.every((f) => !!creds[f.key])} />
        <button
          type="button"
          onClick={handleSave}
          disabled={isLoading}
          className="px-4 py-2 rounded-lg text-sm font-semibold bg-primary-600 hover:bg-primary-700 text-white disabled:opacity-60"
        >
          {isLoading ? "Saving…" : "Save changes"}
        </button>
      </div>
    </Card>
  );
}

// --- Custom providers tab -------------------------------------------------
function CustomProvidersTab({ config }) {
  const [addCustom, { isLoading: adding }] = useAddCustomPaymentMutation();
  const [removeCustom] = useRemoveCustomPaymentMutation();
  const [updateSettings] = useUpdateSettingsMutation();
  const customs = config?.customPayments || [];

  const [draft, setDraft] = useState({
    name: "",
    description: "",
    iconUrl: "",
    enabled: false,
    mode: "test",
    checkoutUrlTemplate: "",
    credentials: {},
  });

  async function handleAdd(e) {
    e.preventDefault();
    if (!draft.name.trim()) {
      toast.error("Provider name is required");
      return;
    }
    const res = await addCustom({
      ...draft,
      id: draft.name.toLowerCase().replace(/[^a-z0-9-_]/g, "-").slice(0, 32),
    });
    if (res?.error) {
      toast.error(res.error?.data?.message || "Could not add provider");
      return;
    }
    toast.success(`${draft.name} added`);
    setDraft({
      name: "",
      description: "",
      iconUrl: "",
      enabled: false,
      mode: "test",
      checkoutUrlTemplate: "",
      credentials: {},
    });
  }

  async function handleToggle(provider, enabled) {
    const next = customs.map((c) =>
      c.id === provider.id ? { ...c, enabled } : c
    );
    await updateSettings({ customPayments: next });
  }

  async function handleRemove(provider) {
    if (!confirm(`Remove ${provider.name}?`)) return;
    await removeCustom(provider.id);
    toast.success("Provider removed");
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2 space-y-3">
        {customs.length === 0 ? (
          <Card className="p-8 text-center text-ink-500 text-sm">
            No custom payment providers yet. Use the panel on the right to add
            one — useful for region-specific gateways or a one-off integration.
          </Card>
        ) : (
          customs.map((p) => (
            <Card key={p.id} className="p-5">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary-50 text-primary-700 flex items-center justify-center shrink-0">
                  <IoCardOutline className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-base font-semibold text-ink-900">
                        {p.name}{" "}
                        <span className="text-xs font-medium uppercase tracking-wide text-ink-500 ml-1">
                          ({p.id})
                        </span>
                      </h3>
                      {p.description ? (
                        <p className="text-xs text-ink-500 mt-0.5">{p.description}</p>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2">
                      <Toggle
                        checked={!!p.enabled}
                        onChange={(v) => handleToggle(p, v)}
                      />
                      <button
                        type="button"
                        onClick={() => handleRemove(p)}
                        className="p-1.5 text-rose-600 hover:bg-rose-50 rounded"
                        aria-label="Remove"
                      >
                        <IoTrashOutline />
                      </button>
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-ink-500">
                    <div className="font-medium">Checkout URL template:</div>
                    <code className="block mt-1 px-2 py-1 bg-ink-50 rounded text-ink-700 break-all">
                      {p.checkoutUrlTemplate || "—"}
                    </code>
                  </div>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      <form onSubmit={handleAdd} className="space-y-4">
        <Card className="p-5">
          <h3 className="text-base font-semibold text-ink-900">
            Add a custom provider
          </h3>
          <p className="text-xs text-ink-500 mt-1">
            For redirect-style gateways the platform doesn&apos;t natively
            support yet. Use{" "}
            <code className="text-xs bg-ink-50 px-1 py-0.5 rounded">
              {"{amount}"}
            </code>
            {", "}
            <code className="text-xs bg-ink-50 px-1 py-0.5 rounded">
              {"{currency}"}
            </code>
            {", "}
            <code className="text-xs bg-ink-50 px-1 py-0.5 rounded">
              {"{orderId}"}
            </code>{" "}
            placeholders.
          </p>

          <div className="space-y-3 mt-4">
            <TextInput
              label="Display name"
              required
              value={draft.name}
              onChange={(v) => setDraft((d) => ({ ...d, name: v }))}
              placeholder="e.g. Razorpay, Mollie, Mercado Pago"
            />
            <TextInput
              label="Short description"
              value={draft.description}
              onChange={(v) => setDraft((d) => ({ ...d, description: v }))}
            />
            <TextInput
              label="Icon URL (optional)"
              value={draft.iconUrl}
              onChange={(v) => setDraft((d) => ({ ...d, iconUrl: v }))}
              placeholder="https://…/logo.svg"
            />
            <TextInput
              label="Checkout URL template"
              value={draft.checkoutUrlTemplate}
              onChange={(v) =>
                setDraft((d) => ({ ...d, checkoutUrlTemplate: v }))
              }
              placeholder="https://pay.example.com/?amt={amount}&cur={currency}&ref={orderId}"
            />
          </div>

          <div className="flex items-center justify-between mt-5">
            <Toggle
              checked={draft.enabled}
              onChange={(v) => setDraft((d) => ({ ...d, enabled: v }))}
              label="Enable immediately"
            />
            <button
              type="submit"
              disabled={adding}
              className="px-4 py-2 rounded-lg text-sm font-semibold bg-primary-600 hover:bg-primary-700 text-white disabled:opacity-60"
            >
              {adding ? "Adding…" : "Add provider"}
            </button>
          </div>
        </Card>
      </form>
    </div>
  );
}

// --- SMTP tab -------------------------------------------------------------
function SmtpTab({ config }) {
  const [updateSettings, { isLoading }] = useUpdateSettingsMutation();
  const smtp = config?.smtp || {};
  const [form, setForm] = useState({
    host: "",
    port: 587,
    secure: false,
    user: "",
    pass: "",
    fromEmail: "",
    fromName: "",
  });

  useEffect(() => {
    if (smtp) setForm((f) => ({ ...f, ...smtp }));
  }, [config]);

  function patch(k, v) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function handleSave() {
    const res = await updateSettings({ smtp: { ...form, port: Number(form.port) || 587 } });
    if (res?.error) {
      toast.error(res.error?.data?.message || "Could not save");
      return;
    }
    toast.success("SMTP settings saved");
  }

  return (
    <div className="space-y-5 max-w-2xl">
      <Card className="p-5">
        <div className="flex items-start gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-primary-50 text-primary-700 flex items-center justify-center">
            <IoMailOutline className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-ink-900">SMTP server</h3>
            <p className="text-xs text-ink-500 mt-0.5">
              Used for every transactional email: signup OTP, password reset,
              order confirmations, deliveries, reviews, withdrawals, etc.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <TextInput label="Host" value={form.host} onChange={(v) => patch("host", v)} placeholder="smtp.gmail.com" />
          <TextInput label="Port" type="number" value={form.port} onChange={(v) => patch("port", v)} placeholder="587" />
          <TextInput label="Username" value={form.user} onChange={(v) => patch("user", v)} />
          <TextInput label="Password" secret value={form.pass} onChange={(v) => patch("pass", v)} />
          <TextInput label="From email" value={form.fromEmail} onChange={(v) => patch("fromEmail", v)} placeholder="noreply@qwlee.com" />
          <TextInput label="From name" value={form.fromName} onChange={(v) => patch("fromName", v)} placeholder="Qwlee" />
        </div>

        <div className="mt-4">
          <Toggle
            checked={!!form.secure}
            onChange={(v) => patch("secure", v)}
            label="Use TLS / SSL (port 465)"
          />
        </div>

        <div className="flex items-center justify-end mt-5 pt-4 border-t border-ink-100">
          <button
            type="button"
            onClick={handleSave}
            disabled={isLoading}
            className="px-4 py-2 rounded-lg text-sm font-semibold bg-primary-600 hover:bg-primary-700 text-white disabled:opacity-60"
          >
            {isLoading ? "Saving…" : "Save SMTP"}
          </button>
        </div>
      </Card>

      <SmtpTester defaultEmail={form.fromEmail} />
    </div>
  );
}

// Test-send panel — fires any of the transactional templates through
// the currently-saved SMTP. Helpful for confirming credentials work
// right after editing them, without having to drive a real flow.
const TEMPLATE_OPTIONS = [
  { value: "verification", label: "Signup verification (OTP)" },
  { value: "resetPassword", label: "Password reset (OTP)" },
  { value: "orderConfirmedBuyer", label: "Order placed (buyer)" },
  { value: "orderConfirmedSeller", label: "New order (seller)" },
  { value: "delivered", label: "Order delivered (buyer)" },
  { value: "accepted", label: "Delivery accepted (seller)" },
  { value: "cancelled", label: "Order cancelled" },
  { value: "extensionRequest", label: "Extension requested (buyer)" },
  { value: "extensionAccepted", label: "Extension accepted (seller)" },
  { value: "reviewReceived", label: "Review received (seller)" },
  { value: "reviewReply", label: "Seller replied to review (buyer)" },
  { value: "customOffer", label: "Custom offer (buyer)" },
  { value: "newMessage", label: "New inbox message" },
  { value: "withdrawalRequested", label: "Withdrawal requested" },
  { value: "withdrawalApproved", label: "Withdrawal approved" },
  { value: "withdrawalDeclined", label: "Withdrawal declined" },
  { value: "accountBanned", label: "Account suspended" },
  { value: "verificationApproved", label: "ID verification approved" },
  { value: "verificationRejected", label: "ID verification rejected" },
  { value: "all", label: "Send every template (smoke test)" },
];

function SmtpTester({ defaultEmail }) {
  const [to, setTo] = useState("");
  const [template, setTemplate] = useState("verification");
  const [sendTest, { isLoading }] = useSendTestEmailMutation();

  useEffect(() => {
    if (defaultEmail && !to) setTo(defaultEmail);
  }, [defaultEmail]);

  async function handleSend() {
    if (!to.trim()) {
      toast.error("Enter a recipient email first");
      return;
    }
    const res = await sendTest({ to: to.trim(), template });
    if (res?.error) {
      toast.error(res.error?.data?.message || "Send failed");
      return;
    }
    toast.success(`Test email sent to ${to.trim()}`);
  }

  return (
    <Card className="p-5">
      <div className="flex items-start gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
          <IoMailOutline className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-semibold text-ink-900">
            Send a test email
          </h3>
          <p className="text-xs text-ink-500 mt-0.5">
            Confirm SMTP is working by sending any template to your inbox.
            Uses the credentials saved above.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[2fr_3fr] gap-3">
        <TextInput
          label="Recipient"
          value={to}
          onChange={setTo}
          placeholder="you@example.com"
        />
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-ink-500 mb-1">
            Template
          </label>
          <select
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-ink-200 text-sm outline-none focus:border-primary-400 bg-white"
          >
            {TEMPLATE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex items-center justify-between mt-4 pt-3 border-t border-ink-100">
        <p className="text-xs text-ink-500">
          Test emails use mock data — no real records are touched.
        </p>
        <button
          type="button"
          onClick={handleSend}
          disabled={isLoading}
          className="px-4 py-2 rounded-lg text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-60"
        >
          {isLoading ? "Sending…" : "Send test"}
        </button>
      </div>
    </Card>
  );
}

// --- Misc tab -------------------------------------------------------------
function MiscTab({ config }) {
  const [updateSettings, { isLoading }] = useUpdateSettingsMutation();
  // Render as a flat key/value list — admin can add a new key or edit
  // existing ones. Simple JSON-friendly format.
  const entries = useMemo(
    () => Object.entries(config?.misc || {}),
    [config?.misc]
  );
  const [rows, setRows] = useState(entries);
  useEffect(() => setRows(entries), [config?.misc]);

  function addRow() {
    setRows((r) => [...r, ["", ""]]);
  }

  function patch(i, k, v) {
    setRows((r) => r.map((row, idx) => (idx === i ? [k, v] : row)));
  }

  function remove(i) {
    setRows((r) => r.filter((_, idx) => idx !== i));
  }

  async function handleSave() {
    const next = {};
    for (const [k, v] of rows) {
      if (k.trim()) next[k.trim()] = v;
    }
    const res = await updateSettings({ misc: next });
    if (res?.error) {
      toast.error(res.error?.data?.message || "Could not save");
      return;
    }
    toast.success("Misc settings saved");
  }

  return (
    <Card className="p-5 max-w-3xl">
      <div className="flex items-start gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl bg-primary-50 text-primary-700 flex items-center justify-center">
          <IoSettingsOutline className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-ink-900">Misc platform settings</h3>
          <p className="text-xs text-ink-500 mt-0.5">
            Free-form key/value bag for things like commission %, currency,
            support email. Reads available via the public app config.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        {rows.length === 0 ? (
          <div className="text-sm text-ink-500 italic">No misc settings yet.</div>
        ) : (
          rows.map(([k, v], i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                value={k}
                onChange={(e) => patch(i, e.target.value, v)}
                placeholder="key"
                className="w-1/3 px-3 py-2 rounded-lg border border-ink-200 text-sm outline-none focus:border-primary-400"
              />
              <input
                value={v ?? ""}
                onChange={(e) => patch(i, k, e.target.value)}
                placeholder="value"
                className="flex-1 px-3 py-2 rounded-lg border border-ink-200 text-sm outline-none focus:border-primary-400"
              />
              <button
                type="button"
                onClick={() => remove(i)}
                className="p-2 text-rose-600 hover:bg-rose-50 rounded"
              >
                <IoTrashOutline />
              </button>
            </div>
          ))
        )}
      </div>

      <div className="flex items-center justify-between mt-5 pt-4 border-t border-ink-100">
        <button
          type="button"
          onClick={addRow}
          className="text-sm font-medium text-primary-700 hover:text-primary-800 inline-flex items-center gap-1"
        >
          <IoAddCircleOutline /> Add row
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={isLoading}
          className="px-4 py-2 rounded-lg text-sm font-semibold bg-primary-600 hover:bg-primary-700 text-white disabled:opacity-60"
        >
          {isLoading ? "Saving…" : "Save misc"}
        </button>
      </div>
    </Card>
  );
}

// --- Account + Legal (the original Settings hub, preserved) ---------------
const ACCOUNT_SECTIONS = [
  {
    title: "Account",
    items: [
      { to: "/dashboard/personalinfo", label: "Personal information", icon: LuUser, desc: "Name, email, profile photo." },
      { to: "/forgotpassword", label: "Change password", icon: LuLock, desc: "Reset the password used to sign in." },
    ],
  },
  {
    title: "Legal & policies",
    items: [
      { to: "/dashboard/privacy", label: "Privacy policy", icon: LuShield, desc: "What we collect and how we use it." },
      { to: "/dashboard/terms", label: "Terms & conditions", icon: LuFileText, desc: "The agreement users accept." },
      { to: "/dashboard/trustsafety", label: "Trust & safety", icon: LuBadgeCheck, desc: "How we keep the marketplace safe." },
    ],
  },
];

function AccountTab() {
  return (
    <div className="space-y-6">
      {ACCOUNT_SECTIONS.map((section) => (
        <div key={section.title}>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-500 mb-2 px-1">
            {section.title}
          </h2>
          <div className="bg-white border border-ink-200 rounded-2xl shadow-card divide-y divide-ink-100 overflow-hidden">
            {section.items.map((item) => (
              <Link
                to={item.to}
                key={item.to}
                className="flex items-center gap-4 px-5 py-4 hover:bg-ink-50/60 transition"
              >
                <span className="w-10 h-10 rounded-xl bg-primary-50 text-primary-700 flex items-center justify-center">
                  <item.icon className="w-5 h-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-ink-900">{item.label}</div>
                  <div className="text-xs text-ink-500">{item.desc}</div>
                </div>
                <IoChevronForward className="text-ink-300" />
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// --- Shared atoms ---------------------------------------------------------
function CredField({ label, value, onChange, placeholder, secret }) {
  const [shown, setShown] = useState(false);
  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-wide text-ink-500 mb-1">
        {label}
      </label>
      <div className="relative">
        <input
          type={secret && !shown ? "password" : "text"}
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full px-3 py-2 pr-16 rounded-lg border border-ink-200 text-sm font-mono outline-none focus:border-primary-400"
        />
        {secret ? (
          <button
            type="button"
            onClick={() => setShown((s) => !s)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-medium text-ink-500 hover:text-ink-700"
          >
            {shown ? "Hide" : "Show"}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function TextInput({ label, value, onChange, placeholder, type = "text", required, secret }) {
  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-wide text-ink-500 mb-1">
        {label}
        {required ? <span className="text-rose-500"> *</span> : null}
      </label>
      <input
        type={secret ? "password" : type}
        required={required}
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 rounded-lg border border-ink-200 text-sm outline-none focus:border-primary-400"
      />
    </div>
  );
}

function Toggle({ checked, onChange, label }) {
  return (
    <label className="inline-flex items-center gap-2 cursor-pointer">
      {label ? <span className="text-sm text-ink-700">{label}</span> : null}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cls(
          "relative w-10 h-5 rounded-full transition",
          checked ? "bg-primary-600" : "bg-ink-200"
        )}
      >
        <span
          className={cls(
            "absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition transform",
            checked ? "translate-x-5" : ""
          )}
        />
      </button>
    </label>
  );
}

function Status({ enabled, ready }) {
  if (!enabled) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-ink-500">
        <IoCloseCircle className="w-4 h-4" />
        Disabled
      </span>
    );
  }
  if (!ready) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-amber-700">
        <IoCloseCircle className="w-4 h-4" />
        Missing credentials
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs text-emerald-700">
      <IoCheckmarkCircle className="w-4 h-4" />
      Live
    </span>
  );
}
