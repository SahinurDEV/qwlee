// /dashboard/backups — last MongoDB backup, kept archives, "Back up now"
// (super admins) and the restore guide.
import { useState } from "react";
import toast from "react-hot-toast";
import PageHeader from "../../common/PageHeader";
import Card from "../../common/Card";
import Button from "../../common/Button";
import { adminFetch, useAdminQuery } from "../../utils/adminApi";
import { formatDate, timeAgo } from "../../utils/format";
import { ErrorNote } from "./ui";

const TONE = { ok: "bg-emerald-50 text-emerald-700", failing: "bg-rose-50 text-rose-700", stale: "bg-amber-50 text-amber-700", never: "bg-ink-100 text-ink-600", "not configured": "bg-ink-100 text-ink-600" };
const size = (b) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

export default function Backups() {
  const { data, error, reload } = useAdminQuery("/admin/backups");
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try {
      await adminFetch("/admin/backups/run", { method: "POST" });
      toast.success("Backup requested — it starts within 30 seconds");
      setTimeout(reload, 2000);
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };
  const last = data?.last;
  return (
    <div className="space-y-4">
      <PageHeader title="Backups" subtitle="MongoDB archives made by the backup service." actions={<><Button variant="secondary" onClick={reload}>Refresh</Button> <Button loading={busy} disabled={!data?.configured || data?.pending} onClick={run}>{data?.pending ? "Backup queued…" : "Back up now"}</Button></>} />
      <ErrorNote error={error} />
      {data ? (
        <Card title="Status">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm" data-testid="backup-status">
            <div><div className="text-xs text-ink-500">Health</div><span className={`px-2 py-0.5 rounded-full text-xs ${TONE[data.health]}`}>{data.health}</span></div>
            <div><div className="text-xs text-ink-500">Last backup</div><div className="font-medium" title={last ? formatDate(last.at, { withTime: true }) : ""}>{last ? timeAgo(last.at) : "—"}</div></div>
            <div><div className="text-xs text-ink-500">Size</div><div className="font-medium">{last?.ok ? size(last.bytes) : "—"}</div></div>
            <div><div className="text-xs text-ink-500">Took</div><div className="font-medium">{last ? `${last.seconds}s` : "—"}</div></div>
            <div><div className="text-xs text-ink-500">Schedule</div><div className="font-medium">{last ? `every ${last.intervalHours}h, keep ${last.keep}` : "—"}</div></div>
            <div><div className="text-xs text-ink-500">Uploads archived</div><div className="font-medium">{last ? (last.uploads ? "Yes" : "No") : "—"}</div></div>
            <div><div className="text-xs text-ink-500">Off-server copy</div><div className={`font-medium ${last && !last.offsite ? "text-amber-700" : ""}`}>{last ? (last.offsite ? "Yes" : "Not set up") : "—"}</div></div>
          </div>
          {last && !last.ok ? <p className="mt-3 text-sm text-rose-700">Last run failed: {last.error || "unknown error"}</p> : null}
          {!data.configured ? <p className="mt-3 text-sm text-ink-600">No backup folder at <code>{data.dir}</code>. Start the <code>backup</code> service from docker-compose.yml.</p> : null}
        </Card>
      ) : null}
      <Card title="Archives" subtitle={`Stored in the "backups" Docker volume on this server.`}>
        <div className="overflow-x-auto"><table className="w-full text-sm" data-testid="backup-files">
          <tbody>
            {(data?.files || []).map((f) => (
              <tr key={f.name} className="border-t border-ink-100"><td className="py-1.5 font-mono text-xs">{f.name}</td><td>{size(f.bytes)}</td><td className="text-ink-500">{formatDate(f.at, { withTime: true })}</td></tr>
            ))}
            {data && !data.files.length ? <tr><td className="py-2 text-ink-500">No archives yet.</td></tr> : null}
          </tbody>
        </table></div>
      </Card>
      <Card title="Restore guide">
        <ol className="list-decimal pl-5 space-y-2 text-sm text-ink-700">
          <li>Turn on <b>Maintenance mode</b> (Site settings) so nobody writes while you restore.</li>
          <li>Pick an archive above. Restore it (this replaces the current data):
            <pre className="mt-1 bg-ink-50 rounded p-2 text-xs overflow-x-auto">docker compose exec backup sh -c 'mongorestore --uri="$MONGODB_URL" --gzip --drop --nsInclude "qwlee.*" --archive=/backups/ARCHIVE_NAME'</pre></li>
          <li>Restart the API so cached settings reload: <code>docker compose restart backend</code></li>
          <li>Check the site, then turn maintenance mode off.</li>
          <li>Archives live on the same server. Copy them elsewhere regularly, e.g. <code>docker compose cp backup:/backups ./offsite-backups</code>, or sync the volume to object storage.</li>
        </ol>
      </Card>
    </div>
  );
}
