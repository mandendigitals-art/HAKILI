import type { Metadata } from "next";
import Link from "next/link";
import { requestPasswordResetAction } from "@/app/actions/auth";
import { AuthCard } from "@/components/auth-card";
import { ActionForm } from "@/components/ui";

export const metadata: Metadata = { title: "Mot de passe oublié" };

export default function ForgotPasswordPage() {
  return (
    <AuthCard
      title="Mot de passe oublié"
      subtitle="Saisissez votre e-mail pour recevoir un lien de réinitialisation."
      footer={<><Link href="/connexion" className="font-semibold text-tech-600">Retour à la connexion</Link></>}
    >
      <ActionForm action={requestPasswordResetAction} submitLabel="Envoyer le lien" submitClassName="btn-primary w-full">
        <div>
          <label className="label" htmlFor="email">E-mail</label>
          <input id="email" name="email" type="email" required autoComplete="email" className="input" />
        </div>
      </ActionForm>
    </AuthCard>
  );
}
