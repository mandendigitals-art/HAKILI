import { saveAssistantAction } from "@/app/actions/workspace";
import { ActionForm } from "@/components/ui";
import type { Assistant } from "@/db/schema";

export function AssistantForm({ assistant, kbs, linked = [] }: { assistant?: Assistant; kbs: { id: string; name: string }[]; linked?: string[] }) {
  return (
    <ActionForm action={saveAssistantAction} submitLabel={assistant ? "Enregistrer" : "Créer l'assistant"}>
      {assistant && <input type="hidden" name="id" value={assistant.id} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2"><label className="label">Nom de l&apos;assistant</label><input name="name" required defaultValue={assistant?.name} className="input" placeholder="Ex. : Assistant RH" /></div>
        <div className="sm:col-span-2"><label className="label">Description (interne)</label><input name="description" defaultValue={assistant?.description ?? ""} className="input" /></div>
        <div className="sm:col-span-2">
          <label className="label">Bases de connaissances utilisées</label>
          {kbs.length === 0 ? <p className="text-sm text-amber-700">Aucune base : créez-en une dans Sources.</p> : (
            <div className="grid gap-2 sm:grid-cols-2">
              {kbs.map((k) => (
                <label key={k.id} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm">
                  <input type="checkbox" name="knowledgeBaseIds" value={k.id} defaultChecked={linked.includes(k.id)} className="accent-tech-600" />{k.name}
                </label>
              ))}
            </div>
          )}
        </div>
        <div className="sm:col-span-2"><label className="label">Consignes (ton, périmètre, formules)</label><textarea name="instructions" rows={4} defaultValue={assistant?.instructions ?? ""} className="input" placeholder="Ex. : Réponds de manière formelle. Si la question concerne la paie, oriente vers le service RH." /></div>
        <div className="sm:col-span-2"><label className="label">Message d&apos;accueil</label><input name="welcomeMessage" defaultValue={assistant?.welcomeMessage ?? ""} className="input" placeholder="Bonjour ! Posez-moi une question sur…" /></div>
        <div><label className="label">Langue de réponse</label>
          <select name="language" defaultValue={assistant?.language ?? "fr"} className="input"><option value="fr">Français</option><option value="en">English</option><option value="bm">Bambara (expérimental)</option></select></div>
        <div><label className="label">Modèle (optionnel, selon fournisseur)</label><input name="model" defaultValue={assistant?.model ?? ""} className="input" placeholder="Par défaut du fournisseur" /></div>
        <div><label className="label">Seuil de confiance (0,05 – 0,9)</label><input name="minConfidence" type="number" step="0.01" min="0.05" max="0.9" defaultValue={assistant?.minConfidence ?? 0.22} className="input" /><p className="mt-1 text-xs text-slate-500">En dessous, l&apos;assistant refuse de répondre.</p></div>
        <div><label className="label">Passages récupérés (2 – 12)</label><input name="topK" type="number" min="2" max="12" defaultValue={assistant?.topK ?? 6} className="input" /></div>
        <div><label className="label">Créativité (0 – 1)</label><input name="temperature" type="number" step="0.1" min="0" max="1" defaultValue={assistant?.temperature ?? 0.2} className="input" /></div>
      </div>
    </ActionForm>
  );
}
