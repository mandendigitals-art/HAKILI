import type { Metadata } from "next";
import { Section, SectionTitle, SiteShell } from "@/components/site-shell";
import { COMPANY, WhatsAppButton } from "@/components/brand";
import { ContactForm } from "@/components/lead-forms";

export const metadata: Metadata = {
  title: "Contact",
  description: "Contactez Manden Digital SARL pour toute question sur HAKILI. Équipe basée à Bamako, réponse sous 48 h ouvrées.",
};

export default function ContactPage() {
  return (
    <SiteShell>
      <Section>
        <SectionTitle
          eyebrow="Contact"
          title="Nous contacter"
          text="Notre équipe à Bamako vous répond en français, du lundi au vendredi de 8 h à 18 h (GMT)."
        />
        <div className="grid gap-8 lg:grid-cols-5">
          <div className="lg:col-span-3">
            <div className="card p-6 sm:p-8">
              <ContactForm />
            </div>
          </div>
          <aside className="lg:col-span-2 space-y-6">
            <div className="card p-6">
              <h2 className="text-lg font-semibold text-nuit-900">{COMPANY.name}</h2>
              <p className="mt-1 text-sm text-slate-600">{COMPANY.city}</p>
              <div className="mt-4 flex flex-col gap-2">
                <WhatsAppButton message="Bonjour, j'ai une question sur HAKILI." />
                <a href={`mailto:${COMPANY.email}`} className="btn-secondary w-full">{COMPANY.email}</a>
                <a href={`tel:${COMPANY.phone.replace(/\s/g, "")}`} className="btn-ghost w-full">{COMPANY.phone}</a>
                <a href={COMPANY.site} target="_blank" rel="noopener noreferrer" className="btn-ghost w-full">mandendigital.com</a>
              </div>
            </div>
            <div className="card p-6">
              <h2 className="text-lg font-semibold text-nuit-900">Support technique</h2>
              <p className="mt-2 text-sm text-slate-600">Les clients disposant d&apos;un abonnement actif bénéficient d&apos;un support prioritaire par e-mail et WhatsApp.</p>
            </div>
          </aside>
        </div>
      </Section>
    </SiteShell>
  );
}
