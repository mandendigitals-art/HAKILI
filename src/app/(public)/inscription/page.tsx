import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { registerAction } from "@/app/actions/auth";
import { AuthCard } from "@/components/auth-card";
import { ActionForm } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Créer mon assistant" };

const SECTORS = ["Entreprise / PME", "Administration", "École / Formation", "Cabinet / Bureau d'études", "ONG", "Service client", "Ressources humaines", "Documentation technique", "Autre"];

export default async function RegisterPage() {
  if (await getCurrentUser()) redirect("/dashboard");
  return (
    <AuthCard title="Créer mon espace" subtitle="Essai gratuit 14 jours. Aucune carte bancaire." footer={<>Déjà un compte ? <Link href="/connexion" className="font-semibold text-tech-600">Se connecter</Link></>}>
      <ActionForm action={registerAction} submitLabel="Créer mon assistant" submitClassName="btn-accent w-full">
        <div><label className="label" htmlFor="organization">Nom de l&apos;organisation</label><input id="organization" name="organization" required className="input" placeholder="Ex. : Cabinet Keïta & Associés" /></div>
        <div><label className="label" htmlFor="sector">Secteur</label>
          <select id="sector" name="sector" className="input">{SECTORS.map((s) => <option key={s}>{s}</option>)}</select></div>
        <div><label className="label" htmlFor="name">Votre nom</label><input id="name" name="name" required className="input" autoComplete="name" /></div>
        <div><label className="label" htmlFor="email">E-mail professionnel</label><input id="email" name="email" type="email" required className="input" autoComplete="email" /></div>
        <div><label className="label" htmlFor="password">Mot de passe (8 caractères min.)</label><input id="password" name="password" type="password" minLength={8} required className="input" autoComplete="new-password" /></div>
        <p className="text-xs text-slate-500">En créant un compte, vous acceptez les <Link href="/cgu" className="underline">conditions d&apos;utilisation</Link> et la <Link href="/confidentialite" className="underline">politique de confidentialité</Link>.</p>
      </ActionForm>
    </AuthCard>
  );
}
