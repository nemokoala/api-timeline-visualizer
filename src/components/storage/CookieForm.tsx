import { useState } from "react";
import type { CookieEntry, CookieSameSite } from "../../types/storage";
import type { CookieWriteInput } from "../../utils/cookieInspector";
import { Button } from "../ui/Button";
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
    <div className="cookie-form">
      <div className="cookie-form-grid">
        <label className="cookie-field">
          <span>Name</span>
          <input
            className="input input-md"
            value={name}
            disabled={isEdit}
            onChange={(event) => setName(event.currentTarget.value)}
            autoFocus={!isEdit}
          />
        </label>
        <label className="cookie-field cookie-field-wide">
          <span>Value</span>
          <input
            className="input input-md"
            value={value}
            onChange={(event) => setValue(event.currentTarget.value)}
            autoFocus={isEdit}
          />
        </label>
        <label className="cookie-field">
          <span>Domain</span>
          <input
            className="input input-md"
            value={domain}
            disabled={isEdit}
            onChange={(event) => setDomain(event.currentTarget.value)}
          />
        </label>
        <label className="cookie-field">
          <span>Path</span>
          <input
            className="input input-md"
            value={path}
            disabled={isEdit}
            onChange={(event) => setPath(event.currentTarget.value)}
          />
        </label>
        <label className="cookie-field">
          <span>SameSite</span>
          <select
            className="input input-md"
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
          </select>
        </label>
        <label className="cookie-field">
          <span>Expires</span>
          <input
            className="input input-md"
            type="datetime-local"
            value={expiresLocal}
            disabled={session}
            onChange={(event) => setExpiresLocal(event.currentTarget.value)}
          />
        </label>
      </div>
      <div className="cookie-form-flags">
        <label className="cookie-check">
          <input
            type="checkbox"
            checked={session}
            onChange={(event) => setSession(event.currentTarget.checked)}
          />
          <span>Session</span>
        </label>
        <label className="cookie-check">
          <input
            type="checkbox"
            checked={secure}
            onChange={(event) => setSecure(event.currentTarget.checked)}
          />
          <span>Secure</span>
        </label>
        <label className="cookie-check">
          <input
            type="checkbox"
            checked={httpOnly}
            onChange={(event) => setHttpOnly(event.currentTarget.checked)}
          />
          <span>HttpOnly</span>
        </label>
      </div>
      <div className="cookie-form-actions">
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
