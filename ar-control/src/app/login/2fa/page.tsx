import { LoginForm } from "@/components/login-form";
import { loginTotp } from "@/lib/login-actions";

export default function TwoFactor() {
  return <LoginForm step="totp" action={loginTotp} />;
}
