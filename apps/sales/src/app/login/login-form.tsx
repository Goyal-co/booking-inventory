"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button, Input, Label, Card, CardHeader, CardTitle, CardContent } from "@booking/ui";

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const searchParams = useSearchParams();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (result?.error) {
      setError("Invalid email or password. Sales accounts only — use rahul@demo.com / password123");
      setLoading(false);
      return;
    }

    window.location.href = "/app/live";
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-50 to-white p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-brand-600">Sales Portal</CardTitle>
          <p className="text-sm text-gray-500">Sign in to access live booking</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Signing in..." : "Sign In"}
            </Button>
          </form>
          <p className="mt-4 text-center text-xs text-gray-400">
            Demo: rahul@demo.com / password123
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
