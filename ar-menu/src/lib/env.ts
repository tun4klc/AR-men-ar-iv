function required(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Eksik ortam değişkeni: ${name}`);
  return value;
}

// NEXT_PUBLIC_* değerleri derleme anında gömülür; bu yüzden doğrudan referans verilir.
export const publicEnv = {
  supabaseUrl: () => required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL),
  supabaseAnonKey: () => required("NEXT_PUBLIC_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  siteUrl: () => process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
};
