import { redirect } from "next/navigation";
import { logoutAction, onboardingAction } from "@/app/actions/auth";
import { AuthCard } from "@/components/auth-card";
import { ActionForm } from "@/components/ui";
import { getOrgContext, requireUser } from "@/lib/auth";

export default async function OnboardingPage() {
  const user = await requireUser();
  if (await getOrgContext()) redirect("/dashboard");
  return (
    <AuthCard title={`Bienvenue, ${user.name}`} subtitle="Créez votre organisation pour commencer." footer={<form action={logoutAction}><button className="text-slate-500 hover:underline">Se déconnecter</button></form>}>
      <ActionForm action={onboardingAction} submitLabel="Créer mon organisation" submitClassName="btn-primary w-full">
        <div><label className="label" htmlFor="organization">Nom de l&apos;organisation</label><input id="organization" name="organization" required className="input" /></div>
        <div><label className="label" htmlFor="sector">Secteur</label><input id="sector" name="sector" className="input" placeholder="Ex. : ONG" /></div>
      </ActionForm>
    </AuthCard>
  );
}
