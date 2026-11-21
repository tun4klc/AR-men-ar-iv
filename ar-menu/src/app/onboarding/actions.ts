"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createUserClient } from "@/lib/supabase/server";
import { slugify } from "@/lib/format";

export type OnboardState = { error?: string } | undefined;

const Schema = z.object({
  name: z.string().trim().min(2, "İşletme adı en az 2 karakter olmalı.").max(120),
  branch: z.string().trim().min(1, "Şube adı gerekli.").max(120),
});

export async function createTenant(_: OnboardState, form: FormData): Promise<OnboardState> {
  const parsed = Schema.safeParse({ name: form.get("name"), branch: form.get("branch") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const slug = slugify(parsed.data.name);
  const branchSlug = slugify(parsed.data.branch) || "merkez";
  if (slug.length < 3) return { error: "İşletme adından geçerli bir adres üretilemedi; daha uzun bir ad deneyin." };

  const supabase = await createUserClient();
  const { data, error } = await supabase.rpc("create_tenant_with_branch", {
    p_name: parsed.data.name, p_slug: slug, p_branch_name: parsed.data.branch, p_branch_slug: branchSlug,
  });
  if (error) {
    if (error.code === "23505") return { error: "Bu isimde bir işletme adresi zaten kullanılıyor; farklı bir ad deneyin." };
    if (error.message.includes("tenant_limit")) return { error: "En fazla 5 işletme oluşturabilirsiniz." };
    return { error: "İşletme oluşturulamadı." };
  }
  redirect(`/dashboard/${data}`);
}
