import { LoginForm } from "@/components/login-form";
import { loginPassword } from "@/lib/login-actions";

export default function Login() {
  return <LoginForm step="password" action={loginPassword} />;
}
