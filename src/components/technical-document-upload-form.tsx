import { uploadTechnicalDocumentAction } from "@/app/actions";
import type { CatalogOption } from "@/types/domain";

type TechnicalDocumentUploadFormProps = {
  manufacturers: CatalogOption[];
  models: CatalogOption[];
  boards: CatalogOption[];
  components: CatalogOption[];
};

export function TechnicalDocumentUploadForm({
  manufacturers,
  models,
  boards,
  components,
}: TechnicalDocumentUploadFormProps) {
  return (
    <form action={uploadTechnicalDocumentAction} className="grid gap-3">
      <input
        required
        type="text"
        name="title"
        placeholder="Título do documento"
        className="rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 text-sm outline-none"
      />
      <select
        required
        name="document_type"
        defaultValue=""
        className="rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 text-sm outline-none"
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
        name="manufacturer_id"
        defaultValue=""
        className="rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 text-sm outline-none"
      >
        <option value="">
          Fabricante (Opcional se houver outro vínculo)
        </option>
        {manufacturers.map((item) => (
          <option key={item.id} value={item.id}>
            {item.name}
          </option>
        ))}
      </select>

      <select
        name="equipment_model_id"
        defaultValue=""
        className="rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 text-sm outline-none"
      >
        <option value="">
          Modelo do equipamento (Opcional)
        </option>
        {models.map((item) => (
          <option key={item.id} value={item.id}>
            {item.name}
          </option>
        ))}
      </select>

      <select
        name="board_id"
        defaultValue=""
        className="rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 text-sm outline-none"
      >
        <option value="">
          Placa de circuito (Opcional)
        </option>
        {boards.map((item) => (
          <option key={item.id} value={item.id}>
            {item.name}
          </option>
        ))}
      </select>

      <select
        name="component_id"
        defaultValue=""
        className="rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 text-sm outline-none"
      >
        <option value="">
          Componente específico (Opcional)
        </option>
        {components.map((item) => (
          <option key={item.id} value={item.id}>
            {item.name}
          </option>
        ))}
      </select>

      <textarea
        name="notes"
        rows={3}
        placeholder="Observações ou contexto técnico"
        className="rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 text-sm outline-none"
      />
      <input
        required
        type="file"
        name="file"
        className="rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 text-sm outline-none"
      />
      <button className="rounded-full bg-[var(--accent-copper)] px-5 py-3 text-sm font-semibold text-white hover:brightness-110 active:scale-98 transition-all">
        Enviar documento
      </button>
    </form>
  );
}
