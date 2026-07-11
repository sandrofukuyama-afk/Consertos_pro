import { uploadTechnicalDocumentAction } from "@/app/actions";
import type { CatalogOption } from "@/types/domain";

type TechnicalDocumentUploadFormProps = {
  manufacturers: CatalogOption[];
};

export function TechnicalDocumentUploadForm({
  manufacturers,
}: TechnicalDocumentUploadFormProps) {
  return (
    <form action={uploadTechnicalDocumentAction} className="grid gap-3">
      <input
        required
        type="text"
        name="title"
        placeholder="Titulo do documento"
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
        required
        name="manufacturer_id"
        defaultValue=""
        className="rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 text-sm outline-none"
      >
        <option value="" disabled>
          Fabricante do documento
        </option>
        {manufacturers.map((item) => (
          <option key={item.id} value={item.id}>
            {item.name}
          </option>
        ))}
      </select>
      <textarea
        name="notes"
        rows={3}
        placeholder="Observacoes ou contexto tecnico"
        className="rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 text-sm outline-none"
      />
      <input
        required
        type="file"
        name="file"
        className="rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 text-sm outline-none"
      />
      <button className="rounded-full bg-[var(--accent-copper)] px-5 py-3 text-sm font-semibold text-white">
        Enviar documento
      </button>
    </form>
  );
}
