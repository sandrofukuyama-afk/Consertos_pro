import {
  createLibraryManufacturerAction,
  createLibraryModelAction,
  uploadTechnicalDocumentAction,
} from "@/app/actions";
import type {
  CatalogOption,
  EquipmentModelCatalogOption,
} from "@/types/domain";

type TechnicalDocumentUploadFormProps = {
  categories: CatalogOption[];
  manufacturers: CatalogOption[];
  models: EquipmentModelCatalogOption[];
  boards: CatalogOption[];
  components: CatalogOption[];
  selectedManufacturerId?: string;
  selectedModelId?: string;
};

export function TechnicalDocumentUploadForm({
  categories,
  manufacturers,
  models,
  boards,
  components,
  selectedManufacturerId,
  selectedModelId,
}: TechnicalDocumentUploadFormProps) {
  return (
    <div className="grid gap-4">
      <form id="upload-technical-document" action={uploadTechnicalDocumentAction} />

      <div className="grid gap-3">
        <input
          form="upload-technical-document"
          required
          type="text"
          name="title"
          placeholder="Título do documento"
          className="w-full rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 text-sm outline-none"
        />
        <select
          form="upload-technical-document"
          required
          name="document_type"
          defaultValue=""
          className="w-full rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 text-sm outline-none"
        >
          <option value="" disabled>
            Tipo do documento
          </option>
          <option value="schematic">Schematic</option>
          <option value="service_manual">Service manual</option>
          <option value="boardview">Boardview</option>
          <option value="datasheet">Datasheet</option>
          <option value="firmware">Firmware</option>
          <option value="bios">BIOS</option>
          <option value="technical_note">Technical note</option>
          <option value="voltage_map">Voltage map</option>
        </select>

        <select
          form="upload-technical-document"
          name="manufacturer_id"
          defaultValue={selectedManufacturerId ?? ""}
          className="w-full rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 text-sm outline-none"
        >
          <option value="">
            Fabricante (opcional se houver outro vínculo)
          </option>
          {manufacturers.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>

        <details className="rounded-[20px] border border-[var(--panel-border)] bg-[var(--background)] p-4">
          <summary className="cursor-pointer text-sm font-semibold text-[var(--accent-copper)]">
            Cadastrar fabricante sem sair desta tela
          </summary>
          <form action={createLibraryManufacturerAction} className="mt-3 grid gap-3">
            <input
              required
              type="text"
              name="name"
              placeholder="Nome do fabricante"
              className="w-full rounded-2xl border border-[var(--panel-border)] bg-[var(--card-surface)] px-4 py-3 text-sm outline-none"
            />
            <input
              type="text"
              name="country"
              placeholder="País (opcional)"
              className="w-full rounded-2xl border border-[var(--panel-border)] bg-[var(--card-surface)] px-4 py-3 text-sm outline-none"
            />
            <textarea
              name="notes"
              rows={2}
              placeholder="Observações do fabricante (opcional)"
              className="w-full rounded-2xl border border-[var(--panel-border)] bg-[var(--card-surface)] px-4 py-3 text-sm outline-none"
            />
            <button className="rounded-full border border-[var(--accent-copper)]/40 px-4 py-2 text-sm font-semibold text-[var(--accent-copper)] transition hover:bg-[var(--accent-copper)]/10">
              Salvar fabricante
            </button>
          </form>
        </details>

        <select
          form="upload-technical-document"
          name="equipment_model_id"
          defaultValue={selectedModelId ?? ""}
          className="w-full rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 text-sm outline-none"
        >
          <option value="">
            Modelo do equipamento (opcional)
          </option>
          {models.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>

        <details className="rounded-[20px] border border-[var(--panel-border)] bg-[var(--background)] p-4">
          <summary className="cursor-pointer text-sm font-semibold text-[var(--accent-copper)]">
            Cadastrar modelo sem sair desta tela
          </summary>
          <form action={createLibraryModelAction} className="mt-3 grid gap-3">
            <select
              required
              name="manufacturer_id"
              defaultValue={selectedManufacturerId ?? ""}
              className="w-full rounded-2xl border border-[var(--panel-border)] bg-[var(--card-surface)] px-4 py-3 text-sm outline-none"
            >
              <option value="" disabled>
                Fabricante do modelo
              </option>
              {manufacturers.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            <select
              required
              name="equipment_category_id"
              defaultValue=""
              className="w-full rounded-2xl border border-[var(--panel-border)] bg-[var(--card-surface)] px-4 py-3 text-sm outline-none"
            >
              <option value="" disabled>
                Categoria do equipamento
              </option>
              {categories.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            <input
              required
              type="text"
              name="model_name"
              placeholder="Nome do modelo"
              className="w-full rounded-2xl border border-[var(--panel-border)] bg-[var(--card-surface)] px-4 py-3 text-sm outline-none"
            />
            <input
              type="text"
              name="family_name"
              placeholder="Família (opcional)"
              className="w-full rounded-2xl border border-[var(--panel-border)] bg-[var(--card-surface)] px-4 py-3 text-sm outline-none"
            />
            <input
              type="text"
              name="revision_label"
              placeholder="Revisão (opcional)"
              className="w-full rounded-2xl border border-[var(--panel-border)] bg-[var(--card-surface)] px-4 py-3 text-sm outline-none"
            />
            <textarea
              name="release_notes"
              rows={2}
              placeholder="Observações do modelo (opcional)"
              className="w-full rounded-2xl border border-[var(--panel-border)] bg-[var(--card-surface)] px-4 py-3 text-sm outline-none"
            />
            <button className="rounded-full border border-[var(--accent-copper)]/40 px-4 py-2 text-sm font-semibold text-[var(--accent-copper)] transition hover:bg-[var(--accent-copper)]/10">
              Salvar modelo
            </button>
          </form>
        </details>

        <select
          form="upload-technical-document"
          name="board_id"
          defaultValue=""
          className="w-full rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 text-sm outline-none"
        >
          <option value="">
            Placa de circuito (opcional)
          </option>
          {boards.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>

        <select
          form="upload-technical-document"
          name="component_id"
          defaultValue=""
          className="w-full rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 text-sm outline-none"
        >
          <option value="">
            Componente específico (opcional)
          </option>
          {components.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>

        <textarea
          form="upload-technical-document"
          name="notes"
          rows={3}
          placeholder="Observações ou contexto técnico"
          className="w-full rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 text-sm outline-none"
        />
        <input
          form="upload-technical-document"
          required
          type="file"
          name="file"
          className="w-full rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 text-sm outline-none"
        />
        <button
          form="upload-technical-document"
          className="w-full rounded-full bg-[var(--accent-copper)] px-5 py-3 text-sm font-semibold text-white transition-all hover:brightness-110 active:scale-98"
        >
          Enviar documento
        </button>
      </div>
    </div>
  );
}
