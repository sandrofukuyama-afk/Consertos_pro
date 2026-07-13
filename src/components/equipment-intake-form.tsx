"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useState, useTransition } from "react";

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
}: {
  label: string;
  name: string;
  placeholder?: string;
  type?: string;
  step?: string;
}) {
  return (
    <label className="grid gap-2 text-sm text-[var(--foreground)]">
      <span className="font-medium">{label}</span>
      <input
        type={type}
        name={name}
        placeholder={placeholder}
        step={step}
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

export function EquipmentIntakeForm({
  action,
  categories,
  manufacturers,
  models,
  error,
}: EquipmentIntakeFormProps) {
  const [categoryId, setCategoryId] = useState("");
  const [manufacturerId, setManufacturerId] = useState("");
  const [modelId, setModelId] = useState("");
  const [isPending, startTransition] = useTransition();

  const selectedCategory = categories.find((item) => item.id === categoryId) ?? null;
  const categorySlug = normalizeCategoryName(selectedCategory?.name ?? "");

  const filteredModels = models.filter((item) => {
    const matchesCategory = !categoryId || item.categoryId === categoryId;
    const matchesManufacturer =
      !manufacturerId || manufacturerId === NEW_OPTION || item.manufacturerId === manufacturerId;

    return matchesCategory && matchesManufacturer;
  });

  const showNewManufacturer = manufacturerId === NEW_OPTION;
  const showModelSelect = Boolean(categoryId);
  const showNewModel =
    modelId === NEW_OPTION || (showNewManufacturer && categoryId.length > 0);

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

      <div className="grid gap-4 md:grid-cols-2">
        <SelectField
          label="Categoria"
          name="equipment_category_id"
          value={categoryId}
          onChange={(value) => {
            setCategoryId(value);
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

      {showNewManufacturer ? (
        <Field
          label="Novo fabricante"
          name="new_manufacturer_name"
          placeholder="Ex.: TCL, Philco, Positivo"
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
            onChange={setModelId}
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
        />
      </div>

      {showNewModel ? (
        <Field
          label="Novo modelo"
          name="new_model_name"
          placeholder="Ex.: UN50AU7700, IdeaPad 3 15ALC6"
        />
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <Field
          label="Ano de fabricação"
          name="manufacturing_year"
          placeholder="Ex.: 2022"
          type="number"
        />
        <Field
          label="Acessórios que vieram"
          name="accessories_included"
          placeholder="Ex.: fonte, controle, carregador, base"
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
              label="Codigo do painel"
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

      <label className="grid gap-2 text-sm text-[var(--foreground)]">
        <span className="font-medium">Relato inicial</span>
        <textarea
          required
          name="initial_problem_report"
          rows={5}
          placeholder="Descreva sintomas, comportamento e o que já foi visto na entrada."
          className="w-full rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 outline-none"
        />
      </label>

      <label className="grid gap-2 text-sm text-[var(--foreground)]">
        <span className="font-medium">Condição física observada</span>
        <textarea
          name="physical_condition_notes"
          rows={4}
          placeholder="Oxidacao, marcas, trincas, sinais de reparo, faltando pecas, etc."
          className="w-full rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 outline-none"
        />
      </label>

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
          className="rounded-full bg-[var(--accent-copper)] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60 disabled:cursor-not-allowed"
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
