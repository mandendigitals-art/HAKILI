import { logoutAction } from "@/app/actions/auth";
import { AuthCard } from "@/components/auth-card";
import { COMPANY } from "@/components/brand";

export default function SuspendedPage() {
  return (
    <AuthCard title="Espace suspendu" subtitle="L'accès à cette organisation est temporairement suspendu.">
      <p className="text-sm text-slate-600">Pour réactiver votre espace, contactez Manden Digital : <a className="text-tech-600 underline" href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a> · {COMPANY.phone}</p>
      <form action={logoutAction} className="mt-6"><button className="btn-secondary w-full">Se déconnecter</button></form>
    </AuthCard>
  );
}
