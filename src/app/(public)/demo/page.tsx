import type { Metadata } from "next";
import { CTA, Section, SectionTitle, SiteShell } from "@/components/site-shell";
import { COMPANY, WhatsAppButton } from "@/components/brand";
import { DemoForm } from "@/components/lead-forms";

export const metadata: Metadata = {
  title: "Demander une démonstration",
  description: "Découvrez HAKILI avec vos propres documents lors d'une démonstration personnalisée, en présentiel à Bamako ou en visioconférence.",
};

export default function DemoPage() {
  return (
    <SiteShell>
      <Section>
        <SectionTitle
          eyebrow="Démonstration"
          title="Demander une démonstration"
          text="Nous vous montrons HAKILI sur vos documents réels, en 30 minutes, en présentiel à Bamako ou en visioconférence."
        />
        <div className="grid gap-8 lg:grid-cols-5">
          <div className="lg:col-span-3">
            <div className="card p-6 sm:p-8">
              <DemoForm />
            </div>
          </div>
          <aside className="lg:col-span-2 space-y-6">
            <div className="card p-6">
              <h2 className="text-lg font-semibold text-nuit-900">Comment ça se passe</h2>
              <ul className="mt-3 space-y-2 text-sm text-slate-600">
                <li className="flex gap-2"><span className="text-orange-500">1.</span> Vous envoyez votre demande ci-contre.</li>
                <li className="flex gap-2"><span className="text-orange-500">2.</span> Nous vous recontactons sous 48 h ouvrées.</li>
                <li className="flex gap-2"><span className="text-orange-500">3.</span> Nous convenons d&apos;un créneau et d&apos;un format.</li>
                <li className="flex gap-2"><span className="text-orange-500">4.</span> Apportez 2 ou 3 documents représentatifs (non confidentiels).</li>
              </ul>
            </div>
            <div className="card p-6">
              <h2 className="text-lg font-semibold text-nuit-900">Préférez un échange direct ?</h2>
              <p className="mt-2 text-sm text-slate-600">Écrivez-nous ou appelez-nous, notre équipe est basée à {COMPANY.city}.</p>
              <div className="mt-4 flex flex-col gap-2">
                <WhatsAppButton message="Bonjour, je souhaite une démonstration de HAKILI." />
                <a href={`mailto:${COMPANY.email}`} className="btn-secondary w-full">{COMPANY.email}</a>
                <a href={`tel:${COMPANY.phone.replace(/\s/g, "")}`} className="btn-ghost w-full">{COMPANY.phone}</a>
              </div>
            </div>
          </aside>
        </div>
      </Section>
      <CTA />
    </SiteShell>
  );
}
