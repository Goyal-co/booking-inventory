"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { Button, Input, Label } from "@booking/ui";

export default function ReceptionLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await signIn("credentials", { email, password, redirect: false });
    if (result?.error) setError("Invalid credentials");
    else window.location.href = "/dashboard";
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
      <form onSubmit={handleSubmit} className="w-full max-w-sm rounded-xl border bg-white p-6 shadow">
        <h1 className="mb-4 text-xl font-bold text-navy-600">Reception Login</h1>
        <div className="mb-3">
          <Label>Email</Label>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="mb-4">
          <Label>Password</Label>
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
        <Button type="submit" className="w-full">Sign In</Button>
      </form>
    </div>
  );
}
