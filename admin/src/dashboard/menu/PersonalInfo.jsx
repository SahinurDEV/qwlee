// Admin profile view. PageHeader + a Card with an avatar block on the
// left and a key/value grid on the right. The Edit button routes to
// /dashboard/editpersonalinfo where actual updates happen.

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { TbEdit, TbMail, TbMapPin, TbCalendar, TbUser } from "react-icons/tb";

import baseUrl from "../../baseUrl";
import getImageUrl from "../../utils/getImageUrl";

import PageHeader from "../../common/PageHeader";
import Card from "../../common/Card";
import Button from "../../common/Button";
import StatusPill from "../../common/StatusPill";
import { formatDate } from "../../utils/format";

export default function PersonalInfo() {
  const cached = (() => {
    try {
      return JSON.parse(localStorage.getItem("user")) || null;
    } catch {
      return null;
    }
  })();

  const [user, setUser] = useState(cached);

  useEffect(() => {
    if (!cached?.id) return;
    (async () => {
      try {
        const res = await fetch(`${baseUrl}/v1/users/${cached.id}`);
        const json = await res.json();
        if (json?.code === 200) setUser(json.data.attributes.user);
      } catch {
        /* fall through — we still render from the cached blob */
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cached?.id]);

  return (
    <div>
      <PageHeader
        title="Personal information"
        subtitle="Your admin account details."
        actions={
          <Link to="/dashboard/editpersonalinfo">
            <Button iconLeft={TbEdit}>Edit profile</Button>
          </Link>
        }
      />

      <Card>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-1 flex flex-col items-center text-center bg-ink-50/60 rounded-2xl p-6">
            <div className="w-32 h-32 rounded-full bg-white border-4 border-white shadow ring-1 ring-ink-100 overflow-hidden">
              {user?.image ? (
                <img
                  src={getImageUrl(user.image)}
                  alt={user.fullName || "Admin"}
                  className="w-full h-full object-cover"
                  onError={(e) => (e.currentTarget.style.visibility = "hidden")}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-3xl font-bold text-primary-700 bg-primary-50">
                  {user?.fullName?.[0]?.toUpperCase() || "A"}
                </div>
              )}
            </div>
            <h2 className="mt-4 text-lg font-semibold text-ink-900">
              {user?.fullName || "Admin"}
            </h2>
            <p className="text-xs text-ink-500 mt-0.5">{user?.email || "—"}</p>
            <div className="mt-2">
              <StatusPill status="ok" label={user?.role || "admin"} />
            </div>
          </div>

          <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4 content-start">
            <InfoCell icon={TbUser} label="Full name" value={user?.fullName || "—"} />
            <InfoCell icon={TbMail} label="Email" value={user?.email || "—"} />
            <InfoCell icon={TbMapPin} label="Location" value={user?.location || "—"} />
            <InfoCell
              icon={TbCalendar}
              label="Account created"
              value={user?.createdAt ? formatDate(user.createdAt) : "—"}
            />
          </div>
        </div>
      </Card>
    </div>
  );
}

function InfoCell({ icon: Icon, label, value }) {
  return (
    <div className="rounded-xl border border-ink-100 px-4 py-3">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-ink-400 font-semibold">
        {Icon ? <Icon className="w-3.5 h-3.5" /> : null}
        {label}
      </div>
      <div className="text-sm text-ink-900 mt-1 break-words">{value}</div>
    </div>
  );
}
