import { useState } from "react";
import type { CookieEntry, CookieSameSite } from "../../types/storage";
import type { CookieWriteInput } from "../../utils/cookieInspector";
import { Button } from "../ui/Button";
import { Input, Select } from "../ui/Input";
import { epochToLocalInput, formatSameSite, hostnameFromUrl } from "./cookieFormat";

const SAME_SITE_OPTIONS: CookieSameSite[] = [
  "lax",
  "strict",
  "none",
  "unspecified",
];

/** 쿠키 추가/편집 폼. edit 모드에서는 name/domain/path(식별자)를 잠근다. */
export function CookieForm({
  mode,
  initial,
  defaultDomain,
  isMutating,
  onSubmit,
  onCancel,
}: {
  mode: "add" | "edit";
  initial?: CookieEntry;
  defaultDomain?: string;
  isMutating: boolean;
  onSubmit: (cookie: CookieWriteInput) => Promise<boolean>;
  onCancel: () => void;
}) {
  const isEdit = mode === "edit";
  const [name, setName] = useState(initial?.name ?? "");
  const [value, setValue] = useState(initial?.value ?? "");
  const [domain, setDomain] = useState(
    initial?.domain ?? hostnameFromUrl(defaultDomain ?? ""),
  );
  const [path, setPath] = useState(initial?.path ?? "/");
  const [sameSite, setSameSite] = useState<CookieSameSite>(
    initial?.sameSite ?? "lax",
  );
  const [secure, setSecure] = useState(initial?.secure ?? false);
  const [httpOnly, setHttpOnly] = useState(initial?.httpOnly ?? false);
  const [session, setSession] = useState(
    initial ? initial.expires === null : false,
  );
  const [expiresLocal, setExpiresLocal] = useState(() =>
    epochToLocalInput(initial?.expires ?? null),
  );

  const handleSubmit = async () => {
    if (!name || isMutating) return;
    const expires =
      session || !expiresLocal
        ? null
        : Math.round(new Date(expiresLocal).getTime() / 1000);
    const hostOnly = isEdit
      ? (initial?.hostOnly ?? false)
      : !domain.startsWith(".");
    await onSubmit({
      name,
      value,
      domain,
      path: path || "/",
      secure,
      httpOnly,
      sameSite,
      hostOnly,
      expires: Number.isNaN(expires as number) ? null : expires,
    });
  };

  return (
    <div className="flex w-full flex-col gap-2.5 p-3">
      <div className="grid grid-cols-2 gap-x-2.5 gap-y-2">
        <label className="flex min-w-0 flex-col gap-[3px] text-[11px] text-ink-weak">
          <span>Name</span>
          <Input
            value={name}
            disabled={isEdit}
            onChange={(event) => setName(event.currentTarget.value)}
            autoFocus={!isEdit}
          />
        </label>
        <label className="col-span-full flex min-w-0 flex-col gap-[3px] text-[11px] text-ink-weak">
          <span>Value</span>
          <Input
            value={value}
            onChange={(event) => setValue(event.currentTarget.value)}
            autoFocus={isEdit}
          />
        </label>
        <label className="flex min-w-0 flex-col gap-[3px] text-[11px] text-ink-weak">
          <span>Domain</span>
          <Input
            value={domain}
            disabled={isEdit}
            onChange={(event) => setDomain(event.currentTarget.value)}
          />
        </label>
        <label className="flex min-w-0 flex-col gap-[3px] text-[11px] text-ink-weak">
          <span>Path</span>
          <Input
            value={path}
            disabled={isEdit}
            onChange={(event) => setPath(event.currentTarget.value)}
          />
        </label>
        <label className="flex min-w-0 flex-col gap-[3px] text-[11px] text-ink-weak">
          <span>SameSite</span>
          <Select
            value={sameSite}
            onChange={(event) =>
              setSameSite(event.currentTarget.value as CookieSameSite)
            }
          >
            {SAME_SITE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {formatSameSite(option)}
              </option>
            ))}
          </Select>
        </label>
        <label className="flex min-w-0 flex-col gap-[3px] text-[11px] text-ink-weak">
          <span>Expires</span>
          <Input
            type="datetime-local"
            value={expiresLocal}
            disabled={session}
            onChange={(event) => setExpiresLocal(event.currentTarget.value)}
          />
        </label>
      </div>
      <div className="flex flex-wrap gap-3.5">
        <label className="inline-flex cursor-pointer items-center gap-1.5 text-[12px] text-ink">
          <input
            type="checkbox"
            checked={session}
            onChange={(event) => setSession(event.currentTarget.checked)}
          />
          <span>Session</span>
        </label>
        <label className="inline-flex cursor-pointer items-center gap-1.5 text-[12px] text-ink">
          <input
            type="checkbox"
            checked={secure}
            onChange={(event) => setSecure(event.currentTarget.checked)}
          />
          <span>Secure</span>
        </label>
        <label className="inline-flex cursor-pointer items-center gap-1.5 text-[12px] text-ink">
          <input
            type="checkbox"
            checked={httpOnly}
            onChange={(event) => setHttpOnly(event.currentTarget.checked)}
          />
          <span>HttpOnly</span>
        </label>
      </div>
      <div className="flex gap-1.5">
        <Button onClick={() => void handleSubmit()} disabled={!name || isMutating}>
          {isEdit ? "Save" : "Add"}
        </Button>
        <Button onClick={onCancel} disabled={isMutating}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
