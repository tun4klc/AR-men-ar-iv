import { AuthForm } from "@/components/auth-form";
import { register } from "@/lib/auth/actions";

export const metadata = { title: "Kayıt" };

export default function RegisterPage() {
  return <AuthForm mode="register" action={register} />;
}
