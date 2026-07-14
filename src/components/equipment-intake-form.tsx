"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useMemo, useState, useTransition } from "react";

import { CatalogShortcutLinks } from "@/components/catalog-shortcut-links";
import {
  matchCatalogOption,
  matchEquipmentModel,
  parseEquipmentCapture,
  type ParsedEquipmentCapture,
} from "@/lib/equipment-capture";
import type { CatalogOption, EquipmentModelCatalogOption } from "@/types/domain";

type EquipmentIntakeFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  categories: CatalogOption[];
  manufacturers: CatalogOption[];
  models: EquipmentModelCatalogOption[];
  error?: string;
};

const NEW_OPTION = "__new__";

function normalizeCategoryName(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");
}

function Field({
  label,
  name,
  placeholder,
  type = "text",
  step,
  value,
  onChange,
}: {
  label: string;
  name: string;
  placeholder?: string;
  type?: string;
  step?: string;
  value?: string;
  onChange?: (value: string) => void;
}) {
  return (
    <label className="grid gap-2 text-sm text-[var(--foreground)]">
      <span className="font-medium">{label}</span>
      <input
        type={type}
        name={name}
        placeholder={placeholder}
        step={step}
        value={value}
        onChange={onChange ? (event) => onChange(event.target.value) : undefined}
        className="w-full rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 outline-none"
      />
    </label>
  );
}

function SelectField({
  label,
  name,
  children,
  value,
  onChange,
  disabled = false,
}: {
  label: string;
  name: string;
  children: ReactNode;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <label className="grid gap-2 text-sm text-[var(--foreground)]">
      <span className="font-medium">{label}</span>
      <select
        name={name}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        className="w-full rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 outline-none disabled:opacity-60"
      >
        {children}
      </select>
    </label>
  );
}

function StaticSelectField({
  label,
  name,
  children,
}: {
  label: string;
  name: string;
  children: ReactNode;
}) {
  return (
    <label className="grid gap-2 text-sm text-[var(--foreground)]">
      <span className="font-medium">{label}</span>
      <select
        name={name}
        defaultValue=""
        className="w-full rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 outline-none"
      >
        {children}
      </select>
    </label>
  );
}

function TextareaField({
  label,
  name,
  rows,
  placeholder,
  value,
  onChange,
  required = false,
}: {
  label: string;
  name: string;
  rows: number;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  return (
    <label className="grid gap-2 text-sm text-[var(--foreground)]">
      <span className="font-medium">{label}</span>
      <textarea
        required={required}
        name={name}
        rows={rows}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 outline-none"
      />
    </label>
  );
}

function buildCaptureSummary(parsed: ParsedEquipmentCapture) {
  const entries = [
    parsed.category ? `Categoria: ${parsed.category}` : null,
    parsed.manufacturer ? `Fabricante: ${parsed.manufacturer}` : null,
    parsed.model ? `Modelo: ${parsed.model}` : null,
    parsed.serialNumber ? `Série: ${parsed.serialNumber}` : null,
    parsed.manufacturingYear ? `Ano: ${parsed.manufacturingYear}` : null,
    parsed.accessoriesIncluded ? `Acessórios: ${parsed.accessoriesIncluded}` : null,
    parsed.initialProblemReport ? `Relato: ${parsed.initialProblemReport}` : null,
    parsed.physicalConditionNotes ? `Condição física: ${parsed.physicalConditionNotes}` : null,
  ].filter(Boolean);

  return entries;
}

export function EquipmentIntakeForm({
  action,
  categories,
  manufacturers,
  models,
  error,
}: EquipmentIntakeFormProps) {
  const [captureText, setCaptureText] = useState("");
  const [captureFeedback, setCaptureFeedback] = useState<string | null>(null);
  const [capturedCategoryName, setCapturedCategoryName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [manufacturerId, setManufacturerId] = useState("");
  const [modelId, setModelId] = useState("");
  const [newManufacturerName, setNewManufacturerName] = useState("");
  const [newModelName, setNewModelName] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [manufacturingYear, setManufacturingYear] = useState("");
  const [accessoriesIncluded, setAccessoriesIncluded] = useState("");
  const [initialProblemReport, setInitialProblemReport] = useState("");
  const [physicalConditionNotes, setPhysicalConditionNotes] = useState("");
  const [isPending, startTransition] = useTransition();

  const selectedCategory = categories.find((item) => item.id === categoryId) ?? null;
  const categorySlug = normalizeCategoryName(selectedCategory?.name ?? capturedCategoryName ?? "");

  const filteredModels = useMemo(() => {
    return models.filter((item) => {
      const matchesCategory = !categoryId || item.categoryId === categoryId;
      const matchesManufacturer =
        !manufacturerId || manufacturerId === NEW_OPTION || item.manufacturerId === manufacturerId;

      return matchesCategory && matchesManufacturer;
    });
  }, [categoryId, manufacturerId, models]);

  const showNewManufacturer = manufacturerId === NEW_OPTION;
  const showModelSelect = Boolean(categoryId);
  const showNewModel =
    modelId === NEW_OPTION || (showNewManufacturer && categoryId.length > 0);

  const parseCaptureIntoForm = () => {
    const parsed = parseEquipmentCapture(captureText);
    const summary = buildCaptureSummary(parsed);

    if (!summary.length) {
      setCaptureFeedback(
        "Não encontrei campos reconhecíveis na captura. Use frases como: marca Samsung, modelo UN50AU7700, número de série 123, ano 2022, acessórios controle, relato inicial liga sem imagem, condição física oxidação.",
      );
      return;
    }

    let resolvedCategoryId = categoryId;
    let resolvedCapturedCategoryName = "";
    let resolvedManufacturerId = manufacturerId;
    let resolvedModelId = modelId;
    let resolvedNewManufacturerName = newManufacturerName;
    let resolvedNewModelName = newModelName;

    if (parsed.category) {
      const matchedCategory = matchCatalogOption(categories, parsed.category);

      if (matchedCategory) {
        resolvedCategoryId = matchedCategory.id;
        resolvedCapturedCategoryName = "";
      } else {
        resolvedCategoryId = "";
        resolvedCapturedCategoryName = parsed.category;
      }
    }

    if (parsed.manufacturer) {
      const matchedManufacturer = matchCatalogOption(manufacturers, parsed.manufacturer);

      if (matchedManufacturer) {
        resolvedManufacturerId = matchedManufacturer.id;
        resolvedNewManufacturerName = "";
      } else {
        resolvedManufacturerId = NEW_OPTION;
        resolvedNewManufacturerName = parsed.manufacturer;
      }
    }

    if (parsed.model) {
      const matchedModel =
        matchEquipmentModel(models, parsed.model, {
          manufacturerId:
            resolvedManufacturerId && resolvedManufacturerId !== NEW_OPTION
              ? resolvedManufacturerId
              : undefined,
          categoryId: resolvedCategoryId || undefined,
        }) ?? matchEquipmentModel(models, parsed.model);

      if (matchedModel) {
        resolvedModelId = matchedModel.id;
        resolvedNewModelName = "";
        resolvedCategoryId = resolvedCategoryId || matchedModel.categoryId;

        if (!parsed.manufacturer) {
          resolvedManufacturerId = matchedModel.manufacturerId;
        }
      } else {
        resolvedModelId = NEW_OPTION;
        resolvedNewModelName = parsed.model;
      }
    }

    setCategoryId(resolvedCategoryId);
    setCapturedCategoryName(resolvedCapturedCategoryName);
    setManufacturerId(resolvedManufacturerId);
    setModelId(resolvedModelId);
    setNewManufacturerName(resolvedNewManufacturerName);
    setNewModelName(resolvedNewModelName);

    if (parsed.serialNumber) {
      setSerialNumber(parsed.serialNumber);
    }

    if (parsed.manufacturingYear) {
      setManufacturingYear(parsed.manufacturingYear.replace(/[^\d]/g, "").slice(0, 4));
    }

    if (parsed.accessoriesIncluded) {
      setAccessoriesIncluded(parsed.accessoriesIncluded);
    }

    if (parsed.initialProblemReport) {
      setInitialProblemReport(parsed.initialProblemReport);
    }

    if (parsed.physicalConditionNotes) {
      setPhysicalConditionNotes(parsed.physicalConditionNotes);
    }

    const needsCategoryHelp =
      !resolvedCategoryId &&
      !resolvedCapturedCategoryName &&
      Boolean(parsed.model) &&
      resolvedModelId === NEW_OPTION;

    setCaptureFeedback(
      needsCategoryHelp
        ? `Captura aplicada: ${summary.join(" | ")} | Falta informar a categoria para permitir o cadastro automático do modelo novo.`
        : `Captura aplicada: ${summary.join(" | ")}`,
    );
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    startTransition(async () => {
      await action(formData);
    });
  };

  return (
    <form onSubmit={handleSubmit} className="mt-6 grid gap-5">
      {error ? (
        <div className="rounded-2xl border border-[rgba(202,106,85,0.28)] bg-[rgba(202,106,85,0.08)] px-4 py-3 text-sm text-[var(--danger)]">
          {error}
        </div>
      ) : null}

      <section className="rounded-[24px] border border-[rgba(45,139,130,0.24)] bg-[rgba(45,139,130,0.08)] p-4 sm:p-5">
        <p className="font-mono text-xs uppercase tracking-[0.22em] text-[var(--accent-teal)]">
          Captura inteligente
        </p>
        <h4 className="mt-2 text-xl font-semibold tracking-tight text-[var(--foreground)]">
          Fale ou digite tudo de uma vez
        </h4>
        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
          Exemplo: categoria notebook, marca Lenovo, modelo IdeaPad 3 15ALC6, número de série
          PF12345, ano 2022, acessórios carregador, relato inicial liga sem vídeo, condição física
          leves marcas na tampa.
        </p>

        <label className="mt-4 grid gap-2 text-sm text-[var(--foreground)]">
          <span className="font-medium">Captura dos dados do aparelho</span>
          <textarea
            name="equipment_capture_text"
            rows={5}
            value={captureText}
            onChange={(event) => setCaptureText(event.target.value)}
            placeholder="Digite ou dite os dados completos do equipamento para preencher o formulário automaticamente."
            className="w-full rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 outline-none"
          />
        </label>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={parseCaptureIntoForm}
            className="rounded-full bg-[var(--accent-teal)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#227e73]"
          >
            Preencher formulário a partir da captura
          </button>
          <button
            type="button"
            onClick={() => {
              setCaptureText("");
              setCaptureFeedback(null);
            }}
            className="rounded-full border border-[var(--panel-border)] px-5 py-3 text-sm font-semibold text-[var(--foreground)]"
          >
            Limpar captura
          </button>
        </div>

        {captureFeedback ? (
          <div className="mt-4 rounded-2xl border border-[rgba(45,139,130,0.24)] bg-[rgba(16,15,22,0.35)] px-4 py-3 text-sm text-[var(--foreground)]">
            {captureFeedback}
          </div>
        ) : null}

        {capturedCategoryName ? (
          <div className="mt-3 rounded-2xl border border-[rgba(109,94,242,0.24)] bg-[rgba(109,94,242,0.08)] px-4 py-3 text-sm text-[var(--foreground)]">
            Categoria nova detectada: <strong>{capturedCategoryName}</strong>. Ela será cadastrada automaticamente no envio.
          </div>
        ) : null}
      </section>

      <input type="hidden" name="captured_category_name" value={capturedCategoryName} />

      <div className="grid gap-4 md:grid-cols-2">
        <SelectField
          label="Categoria"
          name="equipment_category_id"
          value={categoryId}
          onChange={(value) => {
            setCategoryId(value);
            setCapturedCategoryName("");
            setModelId("");
          }}
        >
          <option value="" disabled>
            Selecione
          </option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </SelectField>

        <SelectField
          label="Fabricante"
          name="manufacturer_id"
          value={manufacturerId}
          onChange={(value) => {
            setManufacturerId(value);
            setModelId(value === NEW_OPTION ? NEW_OPTION : "");
            if (value !== NEW_OPTION) {
              setNewManufacturerName("");
            }
          }}
        >
          <option value="">Não sei ainda</option>
          {manufacturers.map((manufacturer) => (
            <option key={manufacturer.id} value={manufacturer.id}>
              {manufacturer.name}
            </option>
          ))}
          <option value={NEW_OPTION}>Cadastrar novo fabricante</option>
        </SelectField>
      </div>

      <CatalogShortcutLinks
        title="Não encontrou a opção?"
        items={[
          { href: "/catalogo-tecnico?tab=categorias", label: "Cadastrar categoria" },
          { href: "/catalogo-tecnico?tab=fabricantes", label: "Cadastrar fabricante" },
          { href: "/catalogo-tecnico?tab=modelos", label: "Cadastrar modelo" },
        ]}
      />

      {showNewManufacturer ? (
        <Field
          label="Novo fabricante"
          name="new_manufacturer_name"
          placeholder="Ex.: TCL, Philco, Positivo"
          value={newManufacturerName}
          onChange={setNewManufacturerName}
        />
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        {showNewManufacturer ? (
          <div className="grid gap-2 text-sm text-[var(--foreground)]">
            <span className="font-medium">Modelo</span>
            <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 text-[var(--muted)]">
              Como você está cadastrando um fabricante novo, informe o modelo logo abaixo.
            </div>
          </div>
        ) : (
          <SelectField
            label="Modelo"
            name="equipment_model_id"
            value={modelId}
            onChange={(value) => {
              setModelId(value);
              if (value !== NEW_OPTION) {
                setNewModelName("");
              }
            }}
            disabled={!showModelSelect}
          >
            <option value="">Não sei ainda</option>
            {filteredModels.map((model) => (
              <option key={model.id} value={model.id}>
                {model.name}
              </option>
            ))}
            <option value={NEW_OPTION}>Cadastrar novo modelo</option>
          </SelectField>
        )}

        <Field
          label="Número de série"
          name="equipment_serial_number"
          placeholder="Ex.: SN123456789"
          value={serialNumber}
          onChange={setSerialNumber}
        />
      </div>

      {showNewModel ? (
        <Field
          label="Novo modelo"
          name="new_model_name"
          placeholder="Ex.: UN50AU7700, IdeaPad 3 15ALC6"
          value={newModelName}
          onChange={setNewModelName}
        />
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <Field
          label="Ano de fabricação"
          name="manufacturing_year"
          placeholder="Ex.: 2022"
          type="number"
          value={manufacturingYear}
          onChange={setManufacturingYear}
        />
        <Field
          label="Acessórios que vieram"
          name="accessories_included"
          placeholder="Ex.: fonte, controle, carregador, base"
          value={accessoriesIncluded}
          onChange={setAccessoriesIncluded}
        />
      </div>

      {categorySlug.includes("television") ? (
        <section className="grid gap-4 rounded-[24px] border border-[var(--panel-border)] bg-[var(--background)] p-4 sm:p-5 md:grid-cols-2">
          <Field
            label="Tamanho da tela"
            name="tv_screen_size_inches"
            placeholder="Ex.: 50"
            type="number"
            step="0.1"
          />
          <StaticSelectField label="Tipo de tela" name="tv_screen_type">
            <option value="">Selecione</option>
            <option value="led">LED</option>
            <option value="lcd">LCD</option>
            <option value="oled">OLED</option>
            <option value="qled">QLED</option>
            <option value="plasma">Plasma</option>
          </StaticSelectField>
          <StaticSelectField label="Tipo de TV" name="tv_kind">
            <option value="">Selecione</option>
            <option value="smart">Smart TV</option>
            <option value="normal">Normal</option>
          </StaticSelectField>
          <StaticSelectField label="Resolução" name="tv_resolution">
            <option value="">Selecione</option>
            <option value="hd">HD</option>
            <option value="full_hd">Full HD</option>
            <option value="4k">4K</option>
            <option value="8k">8K</option>
          </StaticSelectField>
          <div className="md:col-span-2">
            <Field
              label="Código do painel"
              name="tv_panel_code"
              placeholder="Ex.: CY-GK050HGLV1H"
            />
          </div>
        </section>
      ) : null}

      {categorySlug.includes("notebook") ? (
        <section className="grid gap-4 rounded-[24px] border border-[var(--panel-border)] bg-[var(--background)] p-4 sm:p-5 md:grid-cols-2">
          <Field
            label="Processador"
            name="notebook_processor"
            placeholder="Ex.: Ryzen 5 5500U"
          />
          <Field
            label="Memória RAM (GB)"
            name="notebook_ram_gb"
            placeholder="Ex.: 8"
            type="number"
          />
          <StaticSelectField label="Tipo de armazenamento" name="notebook_storage_type">
            <option value="">Selecione</option>
            <option value="ssd_sata">SSD SATA</option>
            <option value="ssd_nvme">SSD NVMe</option>
            <option value="hdd">HD</option>
            <option value="emmc">eMMC</option>
          </StaticSelectField>
          <Field
            label="Armazenamento (GB)"
            name="notebook_storage_capacity_gb"
            placeholder="Ex.: 256"
            type="number"
          />
          <Field
            label="Tamanho da tela"
            name="notebook_screen_size_inches"
            placeholder="Ex.: 15.6"
            type="number"
            step="0.1"
          />
          <StaticSelectField label="Veio com carregador?" name="notebook_charger_included">
            <option value="">Selecione</option>
            <option value="yes">Sim</option>
            <option value="no">Não</option>
          </StaticSelectField>
        </section>
      ) : null}

      {categorySlug.includes("smartphone") ? (
        <section className="grid gap-4 rounded-[24px] border border-[var(--panel-border)] bg-[var(--background)] p-4 sm:p-5 md:grid-cols-2">
          <Field
            label="Armazenamento (GB)"
            name="smartphone_storage_gb"
            placeholder="Ex.: 128"
            type="number"
          />
          <Field
            label="Cor"
            name="smartphone_color"
            placeholder="Ex.: azul, preto, prata"
          />
          <StaticSelectField label="Dual SIM" name="smartphone_dual_sim">
            <option value="">Selecione</option>
            <option value="yes">Sim</option>
            <option value="no">Não</option>
          </StaticSelectField>
          <StaticSelectField label="Biometria" name="smartphone_biometric">
            <option value="">Selecione</option>
            <option value="fingerprint">Digital</option>
            <option value="face_id">Face ID</option>
            <option value="both">Ambos</option>
            <option value="none">Nenhuma</option>
          </StaticSelectField>
          <div className="md:col-span-2">
            <StaticSelectField label="Rede" name="smartphone_network_type">
              <option value="">Selecione</option>
              <option value="4g">4G</option>
              <option value="5g">5G</option>
            </StaticSelectField>
          </div>
        </section>
      ) : null}

      {categorySlug.includes("desktop") ? (
        <section className="grid gap-4 rounded-[24px] border border-[var(--panel-border)] bg-[var(--background)] p-4 sm:p-5 md:grid-cols-2">
          <Field
            label="Processador"
            name="desktop_processor"
            placeholder="Ex.: Core i5 10400"
          />
          <Field
            label="Memória RAM (GB)"
            name="desktop_ram_gb"
            placeholder="Ex.: 16"
            type="number"
          />
          <StaticSelectField label="Tipo de armazenamento" name="desktop_storage_type">
            <option value="">Selecione</option>
            <option value="ssd_sata">SSD SATA</option>
            <option value="ssd_nvme">SSD NVMe</option>
            <option value="hdd">HD</option>
          </StaticSelectField>
          <Field
            label="Armazenamento (GB)"
            name="desktop_storage_capacity_gb"
            placeholder="Ex.: 512"
            type="number"
          />
          <StaticSelectField label="Tem placa de vídeo?" name="desktop_dedicated_gpu">
            <option value="">Selecione</option>
            <option value="yes">Sim</option>
            <option value="no">Não</option>
          </StaticSelectField>
          <Field
            label="Fonte (W)"
            name="desktop_psu_watts"
            placeholder="Ex.: 500"
            type="number"
          />
        </section>
      ) : null}

      <TextareaField
        label="Relato inicial"
        name="initial_problem_report"
        rows={5}
        required
        value={initialProblemReport}
        onChange={setInitialProblemReport}
        placeholder="Descreva sintomas, comportamento e o que já foi visto na entrada."
      />

      <TextareaField
        label="Condição física observada"
        name="physical_condition_notes"
        rows={4}
        value={physicalConditionNotes}
        onChange={setPhysicalConditionNotes}
        placeholder="Oxidação, marcas, trincas, sinais de reparo, faltando peças, etc."
      />

      <label className="grid gap-2 text-sm text-[var(--foreground)]">
        <span className="font-medium">Fotos do equipamento</span>
        <input
          type="file"
          name="equipment_photos"
          accept="image/*"
          multiple
          className="w-full rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 text-sm outline-none"
        />
        <span className="text-xs text-[var(--muted)]">
          Pode enviar uma ou mais fotos já na entrada do equipamento.
        </span>
      </label>

      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          disabled={isPending}
          className="rounded-full bg-[var(--accent-copper)] px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? "Cadastrando..." : "Cadastrar equipamento"}
        </button>
        <Link
          href="/"
          className="rounded-full border border-[var(--panel-border)] px-5 py-3 text-center text-sm font-semibold text-[var(--foreground)]"
        >
          Cancelar
        </Link>
      </div>
    </form>
  );
}
