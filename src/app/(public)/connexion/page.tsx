import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { loginAction } from "@/app/actions/auth";
import { AuthCard } from "@/components/auth-card";
import { ActionForm } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Connexion" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ reinitialise?: string }> }) {
  if (await getCurrentUser()) redirect("/dashboard");
  const { reinitialise } = await searchParams;
  return (
    <AuthCard
      title="Connexion"
      subtitle="Accédez à votre espace HAKILI."
      footer={
        <>
          Pas encore de compte ? <Link href="/inscription" className="font-semibold text-tech-600">Créer mon assistant</Link>
        </>
      }
    >
      {reinitialise && (
        <div role="status" className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          Votre mot de passe a été mis à jour. Vous pouvez vous connecter.
        </div>
      )}
      <ActionForm action={loginAction} submitLabel="Se connecter" submitClassName="btn-primary w-full">
        <div>
          <label className="label" htmlFor="email">E-mail</label>
          <input id="email" name="email" type="email" required autoComplete="email" className="input" />
        </div>
        <div>
          <div className="flex items-center justify-between">
            <label className="label" htmlFor="password">Mot de passe</label>
            <Link href="/mot-de-passe-oublie" className="mb-1 text-xs font-medium text-tech-600 hover:underline">Mot de passe oublié ?</Link>
          </div>
          <input id="password" name="password" type="password" required autoComplete="current-password" className="input" />
        </div>
      </ActionForm>
    </AuthCard>
  );
}
