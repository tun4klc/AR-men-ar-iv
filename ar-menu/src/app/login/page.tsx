import { AuthForm } from "@/components/auth-form";
import { login } from "@/lib/auth/actions";
import { safeNextPath } from "@/lib/safe-next";

export const metadata = { title: "Giriş" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return <AuthForm mode="login" action={login} next={safeNextPath(next)} />;
}
