"use client";

import { useState } from "react";
import { addTextAction, addUrlAction, createKnowledgeBaseAction, uploadFileAction } from "@/app/actions/workspace";
import { ActionForm } from "@/components/ui";

function KbSelectField({ kbs, defaultKb }: { kbs: { id: string; name: string }[]; defaultKb?: string }) {
  return (
    <div>
      <label className="label">Base de connaissances</label>
      <select name="knowledgeBaseId" required defaultValue={defaultKb} className="input">
        {kbs.map((k) => (
          <option key={k.id} value={k.id}>
            {k.name}
          </option>
        ))}
      </select>
    </div>
  );
}

export function SourceForms({ kbs, defaultKb }: { kbs: { id: string; name: string }[]; defaultKb?: string }) {
  const [tab, setTab] = useState<"file" | "url" | "text" | "qa">("file");
  const tabs = [["file", "📄 Fichier"], ["url", "🌐 Site web"], ["text", "📝 Texte"], ["qa", "❓ Question-réponse"]] as const;

  return (
    <div className="card p-5">
      <div className="mb-4 flex flex-wrap gap-1 rounded-lg bg-slate-100 p-1">
        {tabs.map(([k, l]) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={`rounded-md px-3 py-1.5 text-sm ${tab === k ? "bg-white font-semibold text-nuit-900 shadow-sm" : "text-slate-600"}`}
          >
            {l}
          </button>
        ))}
      </div>
      {tab === "file" && (
        <ActionForm action={uploadFileAction} submitLabel="Importer et traiter" resetOnSuccess>
          <KbSelectField kbs={kbs} defaultKb={defaultKb} />
          <div><label className="label">Fichier PDF, DOCX ou TXT (15 Mo max.)</label><input type="file" name="file" required accept=".pdf,.docx,.txt,.md,application/pdf,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="input" /></div>
          <p className="text-xs text-slate-500">Le traitement (extraction, découpage, vectorisation) prend de quelques secondes à une minute selon la taille.</p>
        </ActionForm>
      )}
      {tab === "url" && (
        <ActionForm action={addUrlAction} submitLabel="Ajouter la page" resetOnSuccess>
          <KbSelectField kbs={kbs} defaultKb={defaultKb} />
          <div><label className="label">Adresse de la page</label><input type="url" name="url" required placeholder="https://www.monsite.ml/faq" className="input" /></div>
          <p className="text-xs text-slate-500">Une page à la fois. Ajoutez vos pages clés : FAQ, procédures, présentation des services.</p>
        </ActionForm>
      )}
      {tab === "text" && (
        <ActionForm action={addTextAction} submitLabel="Ajouter le texte" resetOnSuccess>
          <input type="hidden" name="type" value="text" />
          <KbSelectField kbs={kbs} defaultKb={defaultKb} />
          <div><label className="label">Titre</label><input name="title" required className="input" placeholder="Ex. : Horaires d'ouverture" /></div>
          <div><label className="label">Contenu</label><textarea name="content" required rows={8} className="input" /></div>
        </ActionForm>
      )}
      {tab === "qa" && (
        <ActionForm action={addTextAction} submitLabel="Ajouter la Q&R" resetOnSuccess>
          <input type="hidden" name="type" value="qa" />
          <KbSelectField kbs={kbs} defaultKb={defaultKb} />
          <div><label className="label">Question</label><input name="question" required className="input" placeholder="Ex. : Quels sont les délais de livraison ?" /></div>
          <div><label className="label">Réponse</label><textarea name="answer" required rows={5} className="input" /></div>
        </ActionForm>
      )}
    </div>
  );
}

export function NewKbForm() {
  return (
    <ActionForm action={createKnowledgeBaseAction} submitLabel="Créer la base" resetOnSuccess className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="flex-1"><label className="label">Nom de la base</label><input name="name" required className="input" placeholder="Ex. : Procédures RH" /></div>
      <div className="flex-1"><label className="label">Description</label><input name="description" className="input" /></div>
    </ActionForm>
  );
}
