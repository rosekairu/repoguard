"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const USERNAME = /^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$/;

export function ScanForm() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    // Accept "rosekairu", "@rosekairu" or a pasted profile URL
    const name = value.trim().replace(/^@/, "").replace(/^https?:\/\/(www\.)?github\.com\//i, "").split(/[/?#]/)[0];
    if (!USERNAME.test(name)) {
      setError("Enter a GitHub username, like rosekairu.");
      return;
    }
    setError(null);
    router.push(`/u/${name}`);
  }

  return (
    <form onSubmit={submit} noValidate style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <label htmlFor="username" className="sr-only">
          GitHub username
        </label>
        <input
          id="username"
          className="field"
          style={{ flex: "1 1 260px" }}
          placeholder="your github username"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "username-error" : undefined}
        />
        <button className="btn btn-primary" style={{ minHeight: 56, padding: "0 28px", fontSize: 17 }}>
          Sniff it out
        </button>
      </div>
      {error && (
        <p id="username-error" role="alert" style={{ margin: 0, fontWeight: 600, color: "#a3260f" }}>
          {error}
        </p>
      )}
    </form>
  );
}
