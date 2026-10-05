"use client";

import { submitContactAction, submitDemoAction } from "@/app/actions/leads";
import { ActionForm } from "@/components/ui";

const SECTORS = [
  "Entreprise / PME",
  "Administration",
  "École / Formation",
  "Cabinet / Bureau d'études",
  "ONG",
  "Service client",
  "Ressources humaines",
  "Documentation technique",
  "Autre",
];

export function ContactForm() {
  return (
    <ActionForm action={submitContactAction} submitLabel="Envoyer le message" submitClassName="btn-primary w-full" resetOnSuccess>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label" htmlFor="c-name">Nom complet</label>
          <input id="c-name" name="fullName" required maxLength={120} className="input" autoComplete="name" />
        </div>
        <div>
          <label className="label" htmlFor="c-email">E-mail</label>
          <input id="c-email" name="email" type="email" required className="input" autoComplete="email" />
        </div>
        <div>
          <label className="label" htmlFor="c-phone">Téléphone / WhatsApp (facultatif)</label>
          <input id="c-phone" name="phone" className="input" autoComplete="tel" placeholder="+223 …" />
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="c-org">Organisation (facultatif)</label>
          <input id="c-org" name="organization" className="input" autoComplete="organization" />
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="c-msg">Votre message</label>
          <textarea id="c-msg" name="message" required rows={5} maxLength={4000} className="input" />
        </div>
      </div>
    </ActionForm>
  );
}

export function DemoForm() {
  return (
    <ActionForm action={submitDemoAction} submitLabel="Demander ma démonstration" submitClassName="btn-accent w-full" resetOnSuccess>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="d-name">Nom complet</label>
          <input id="d-name" name="fullName" required maxLength={120} className="input" autoComplete="name" />
        </div>
        <div>
          <label className="label" htmlFor="d-org">Organisation</label>
          <input id="d-org" name="organization" className="input" autoComplete="organization" />
        </div>
        <div>
          <label className="label" htmlFor="d-sector">Secteur</label>
          <select id="d-sector" name="sector" className="input" defaultValue="">
            <option value="" disabled>Choisir…</option>
            {SECTORS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="d-phone">Téléphone / WhatsApp</label>
          <input id="d-phone" name="phone" required className="input" autoComplete="tel" placeholder="+223 …" />
        </div>
        <div>
          <label className="label" htmlFor="d-email">E-mail</label>
          <input id="d-email" name="email" type="email" required className="input" autoComplete="email" />
        </div>
        <div>
          <label className="label" htmlFor="d-mode">Format de la démonstration</label>
          <select id="d-mode" name="mode" className="input" defaultValue="visio">
            <option value="visio">Visioconférence</option>
            <option value="presentiel">Présentiel (Bamako)</option>
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="d-date">Date souhaitée (facultatif)</label>
          <input id="d-date" name="preferredDate" type="date" className="input" />
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="d-msg">Message (facultatif)</label>
          <textarea id="d-msg" name="message" rows={4} maxLength={4000} className="input" placeholder="Vos besoins, le type de documents, vos questions…" />
        </div>
      </div>
    </ActionForm>
  );
}
