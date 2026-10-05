import type { Metadata } from "next";
import Link from "next/link";
import { resetPasswordAction } from "@/app/actions/auth";
import { AuthCard } from "@/components/auth-card";
import { ActionForm } from "@/components/ui";

export const metadata: Metadata = { title: "Réinitialiser le mot de passe" };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return (
    <AuthCard
      title="Nouveau mot de passe"
      subtitle="Choisissez un nouveau mot de passe pour votre compte."
      footer={<><Link href="/connexion" className="font-semibold text-tech-600">Retour à la connexion</Link></>}
    >
      {!token ? (
        <p className="text-sm text-red-600">Lien invalide : aucun jeton fourni. Recommencez la procédure de réinitialisation.</p>
      ) : (
        <ActionForm action={resetPasswordAction} submitLabel="Mettre à jour le mot de passe" submitClassName="btn-primary w-full">
          <input type="hidden" name="token" value={token} />
          <div>
            <label className="label" htmlFor="password">Nouveau mot de passe (8 caractères min.)</label>
            <input id="password" name="password" type="password" minLength={8} required autoComplete="new-password" className="input" />
          </div>
          <div>
            <label className="label" htmlFor="confirm">Confirmer le mot de passe</label>
            <input id="confirm" name="confirm" type="password" minLength={8} required autoComplete="new-password" className="input" />
          </div>
        </ActionForm>
      )}
    </AuthCard>
  );
}
