import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { requireCurrentUser } from "@/lib/auth";
import { getCatalogDashboardData } from "@/lib/services/catalog";
import {
  createBoardAction,
  createBoardComponentAction,
  createBoardTypeAction,
  createCategoryAction,
  createManufacturerAction,
  createModelAction,
  createModelBoardAction,
  createComponentAction,
  createSymptomAction,
  createTestAction,
} from "./actions";

type CatalogoPageProps = {
  searchParams: Promise<{
    tab?: string;
    error?: string;
    success?: string;
    q?: string;
  }>;
};

export default async function CatalogoTecnicoPage({ searchParams }: CatalogoPageProps) {
  const user = await requireCurrentUser();
  const params = await searchParams;

  const activeTab = params.tab || "modelos";
  const error = params.error || null;
  const success = params.success || null;
  const q = params.q || "";

  const data = await getCatalogDashboardData();
  const {
    categories,
    manufacturers,
    boardTypes,
    models,
    boards,
    components,
    symptoms,
    tests,
    modelBoards,
    boardComponents,
  } = data;

  const searchLower = q.toLowerCase();

  // Filters
  const filteredCategories = categories.filter((item: any) => {
    if (!searchLower) return true;
    return (
      item.name.toLowerCase().includes(searchLower) ||
      (item.slug?.toLowerCase() || "").includes(searchLower) ||
      (item.description?.toLowerCase() || "").includes(searchLower)
    );
  });

  const filteredManufacturers = manufacturers.filter((item: any) => {
    if (!searchLower) return true;
    return (
      item.name.toLowerCase().includes(searchLower) ||
      (item.country?.toLowerCase() || "").includes(searchLower) ||
      (item.notes?.toLowerCase() || "").includes(searchLower)
    );
  });

  const filteredBoardTypes = boardTypes.filter((item: any) => {
    if (!searchLower) return true;
    return (
      item.name.toLowerCase().includes(searchLower) ||
      (item.slug?.toLowerCase() || "").includes(searchLower) ||
      (item.description?.toLowerCase() || "").includes(searchLower)
    );
  });

  const filteredModels = models.filter((item: any) => {
    if (!searchLower) return true;
    return (
      item.model_name.toLowerCase().includes(searchLower) ||
      (item.family_name?.toLowerCase() || "").includes(searchLower) ||
      (item.manufacturers?.name?.toLowerCase() || "").includes(searchLower) ||
      (item.equipment_categories?.name?.toLowerCase() || "").includes(searchLower)
    );
  });

  const filteredBoards = boards.filter((item: any) => {
    if (!searchLower) return true;
    return (
      item.board_code.toLowerCase().includes(searchLower) ||
      (item.board_revision?.toLowerCase() || "").includes(searchLower) ||
      (item.description?.toLowerCase() || "").includes(searchLower) ||
      (item.manufacturers?.name?.toLowerCase() || "").includes(searchLower) ||
      (item.board_types?.name?.toLowerCase() || "").includes(searchLower)
    );
  });

  const filteredComponents = components.filter((item: any) => {
    if (!searchLower) return true;
    return (
      item.component_ref.toLowerCase().includes(searchLower) ||
      item.component_type.toLowerCase().includes(searchLower) ||
      (item.manufacturer_part_number?.toLowerCase() || "").includes(searchLower) ||
      (item.generic_part_number?.toLowerCase() || "").includes(searchLower) ||
      (item.description?.toLowerCase() || "").includes(searchLower)
    );
  });

  const filteredModelBoards = modelBoards.filter((item: any) => {
    if (!searchLower) return true;
    return (
      (item.equipment_models?.model_name?.toLowerCase() || "").includes(searchLower) ||
      (item.boards?.board_code?.toLowerCase() || "").includes(searchLower) ||
      item.role_label.toLowerCase().includes(searchLower)
    );
  });

  const filteredBoardComponents = boardComponents.filter((item: any) => {
    if (!searchLower) return true;
    return (
      (item.boards?.board_code?.toLowerCase() || "").includes(searchLower) ||
      (item.components?.component_ref?.toLowerCase() || "").includes(searchLower) ||
      item.reference_designator.toLowerCase().includes(searchLower) ||
      (item.circuit_function?.toLowerCase() || "").includes(searchLower)
    );
  });

  const filteredSymptoms = symptoms.filter((item: any) => {
    if (!searchLower) return true;
    return (
      item.name.toLowerCase().includes(searchLower) ||
      (item.symptom_group?.toLowerCase() || "").includes(searchLower) ||
      (item.description?.toLowerCase() || "").includes(searchLower) ||
      (item.equipment_categories?.name?.toLowerCase() || "").includes(searchLower)
    );
  });

  const filteredTests = tests.filter((item: any) => {
    if (!searchLower) return true;
    return (
      item.name.toLowerCase().includes(searchLower) ||
      (item.test_group?.toLowerCase() || "").includes(searchLower) ||
      (item.description?.toLowerCase() || "").includes(searchLower) ||
      (item.default_unit?.toLowerCase() || "").includes(searchLower)
    );
  });

  const tabs = [
    { id: "categorias", label: "Categorias" },
    { id: "fabricantes", label: "Fabricantes" },
    { id: "tipos-de-placa", label: "Tipos de placa" },
    { id: "modelos", label: "Modelos" },
    { id: "placas", label: "Placas" },
    { id: "componentes", label: "Componentes" },
    { id: "sintomas", label: "Sintomas" },
    { id: "testes", label: "Testes" },
    { id: "vinculos-modelo-placa", label: "Modelo ↔ Placa" },
    { id: "componentes-placa", label: "Componentes da Placa" },
  ];

  return (
    <AppShell
      title="Central de cadastros"
      description="Aqui ficam categorias, fabricantes, tipos de placa, modelos, placas, componentes, sintomas e testes organizados de forma centralizada."
      user={user}
    >
      <div className="flex flex-col gap-6">
        {/* Navigation Tabs */}
        <div className="flex border-b border-[var(--panel-border)] overflow-x-auto pb-px scrollbar-none gap-2">
          {tabs.map((tab) => {
            const isTabActive = activeTab === tab.id;
            return (
              <Link
                key={tab.id}
                href={`/catalogo-tecnico?tab=${tab.id}`}
                className={`whitespace-nowrap px-4 py-2 text-sm font-semibold border-b-2 transition ${
                  isTabActive
                    ? "border-[var(--accent-copper)] text-white bg-white/5 rounded-t-xl"
                    : "border-transparent text-[var(--muted)] hover:text-white hover:border-white/20"
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>

        {/* Status Messages */}
        {error && (
          <div className="rounded-2xl border border-[rgba(202,106,85,0.28)] bg-[rgba(202,106,85,0.08)] px-4 py-3 text-sm text-[var(--danger)]">
            {error}
          </div>
        )}
        {success && (
          <div className="rounded-2xl border border-[rgba(62,158,114,0.28)] bg-[rgba(62,158,114,0.08)] px-4 py-3 text-sm text-[var(--success)]">
            {success}
          </div>
        )}

        {/* Dashboard layout */}
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.85fr)]">
          {/* List Section */}
          <section className="rounded-[30px] border border-[var(--panel-border)] bg-[var(--card-surface)] p-4 sm:p-6 shadow-[0_18px_44px_rgba(72,62,49,0.06)] flex flex-col gap-4 self-start">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-[var(--panel-border)]">
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
                  Catálogo
                </p>
                <h3 className="mt-1 text-2xl font-semibold tracking-tight text-white">
                  {tabs.find((t) => t.id === activeTab)?.label} cadastrados
                </h3>
              </div>

              {/* Search Bar */}
              <form method="GET" className="flex items-center w-full sm:w-auto min-w-0 max-w-sm gap-2">
                <input type="hidden" name="tab" value={activeTab} />
                <input
                  type="text"
                  name="q"
                  placeholder="Filtrar dados..."
                  defaultValue={q}
                  className="w-full rounded-full border border-[var(--panel-border)] bg-[var(--background)] px-4 py-2 text-sm outline-none text-white placeholder-[var(--muted)]"
                />
                <button className="rounded-full bg-[var(--card-surface-soft)] hover:bg-white/5 border border-[var(--panel-border)] px-4 py-2 text-xs font-semibold text-white transition">
                  Filtrar
                </button>
                {q && (
                  <Link
                    href={`/catalogo-tecnico?tab=${activeTab}`}
                    className="text-xs text-[var(--muted)] hover:text-white underline px-1 whitespace-nowrap"
                  >
                    Limpar
                  </Link>
                )}
              </form>
            </div>

            {/* Tab: Models */}
            {activeTab === "modelos" && (
              <div className="overflow-x-auto rounded-2xl border border-[var(--panel-border)]">
                <table className="w-full text-left text-sm text-[var(--foreground)] border-collapse">
                  <thead>
                    <tr className="bg-[var(--background-strong)] text-xs font-mono uppercase tracking-[0.18em] text-[var(--muted)] border-b border-[var(--panel-border)]">
                      <th className="px-4 py-3">Modelo</th>
                      <th className="px-4 py-3">Fabricante</th>
                      <th className="px-4 py-3">Categoria</th>
                      <th className="px-4 py-3">Família</th>
                      <th className="px-4 py-3">Revisão</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredModels.length > 0 ? (
                      filteredModels.map((item: any) => (
                        <tr key={item.id} className="border-b border-[var(--panel-border)] hover:bg-white/2 transition">
                          <td className="px-4 py-3 font-semibold text-white">{item.model_name}</td>
                          <td className="px-4 py-3">{item.manufacturers?.name ?? "N/A"}</td>
                          <td className="px-4 py-3">{item.equipment_categories?.name ?? "N/A"}</td>
                          <td className="px-4 py-3 font-mono text-xs">{item.family_name || "-"}</td>
                          <td className="px-4 py-3 text-xs">{item.revision_label || "-"}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-[var(--muted)]">
                          Nenhum modelo cadastrado.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Tab: Boards */}
            {activeTab === "placas" && (
              <div className="overflow-x-auto rounded-2xl border border-[var(--panel-border)]">
                <table className="w-full text-left text-sm text-[var(--foreground)] border-collapse">
                  <thead>
                    <tr className="bg-[var(--background-strong)] text-xs font-mono uppercase tracking-[0.18em] text-[var(--muted)] border-b border-[var(--panel-border)]">
                      <th className="px-4 py-3">Código</th>
                      <th className="px-4 py-3">Tipo</th>
                      <th className="px-4 py-3">Fabricante</th>
                      <th className="px-4 py-3">Revisão</th>
                      <th className="px-4 py-3">Descrição</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredBoards.length > 0 ? (
                      filteredBoards.map((item: any) => (
                        <tr key={item.id} className="border-b border-[var(--panel-border)] hover:bg-white/2 transition">
                          <td className="px-4 py-3 font-mono font-semibold text-[var(--accent-copper)]">{item.board_code}</td>
                          <td className="px-4 py-3">{item.board_types?.name ?? "N/A"}</td>
                          <td className="px-4 py-3">{item.manufacturers?.name ?? "N/A"}</td>
                          <td className="px-4 py-3 font-mono text-xs">{item.board_revision || "-"}</td>
                          <td className="px-4 py-3 text-xs max-w-xs truncate">{item.description || "-"}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-[var(--muted)]">
                          Nenhuma placa cadastrada.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Tab: Components */}
            {activeTab === "componentes" && (
              <div className="overflow-x-auto rounded-2xl border border-[var(--panel-border)]">
                <table className="w-full text-left text-sm text-[var(--foreground)] border-collapse">
                  <thead>
                    <tr className="bg-[var(--background-strong)] text-xs font-mono uppercase tracking-[0.18em] text-[var(--muted)] border-b border-[var(--panel-border)]">
                      <th className="px-4 py-3">Referência</th>
                      <th className="px-4 py-3">Tipo</th>
                      <th className="px-4 py-3">MPN</th>
                      <th className="px-4 py-3">Invólucro</th>
                      <th className="px-4 py-3">Descrição</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredComponents.length > 0 ? (
                      filteredComponents.map((item: any) => (
                        <tr key={item.id} className="border-b border-[var(--panel-border)] hover:bg-white/2 transition">
                          <td className="px-4 py-3 font-mono font-semibold text-white">{item.component_ref}</td>
                          <td className="px-4 py-3 font-semibold text-[var(--accent-teal)]">{item.component_type}</td>
                          <td className="px-4 py-3 font-mono text-xs">{item.manufacturer_part_number || "-"}</td>
                          <td className="px-4 py-3 text-xs">{item.package_type || "-"}</td>
                          <td className="px-4 py-3 text-xs max-w-xs truncate">{item.description || "-"}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-[var(--muted)]">
                          Nenhum componente cadastrado.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === "sintomas" && (
              <div className="overflow-x-auto rounded-2xl border border-[var(--panel-border)]">
                <table className="w-full text-left text-sm text-[var(--foreground)] border-collapse">
                  <thead>
                    <tr className="bg-[var(--background-strong)] text-xs font-mono uppercase tracking-[0.18em] text-[var(--muted)] border-b border-[var(--panel-border)]">
                      <th className="px-4 py-3">Sintoma</th>
                      <th className="px-4 py-3">Categoria</th>
                      <th className="px-4 py-3">Grupo</th>
                      <th className="px-4 py-3">Descrição</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSymptoms.length > 0 ? (
                      filteredSymptoms.map((item: any) => (
                        <tr key={item.id} className="border-b border-[var(--panel-border)] hover:bg-white/2 transition">
                          <td className="px-4 py-3 font-semibold text-white">{item.name}</td>
                          <td className="px-4 py-3">{item.equipment_categories?.name ?? "N/A"}</td>
                          <td className="px-4 py-3 text-xs">{item.symptom_group || "-"}</td>
                          <td className="px-4 py-3 text-xs max-w-xs truncate">{item.description || "-"}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center text-[var(--muted)]">
                          Nenhum sintoma cadastrado.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === "testes" && (
              <div className="overflow-x-auto rounded-2xl border border-[var(--panel-border)]">
                <table className="w-full text-left text-sm text-[var(--foreground)] border-collapse">
                  <thead>
                    <tr className="bg-[var(--background-strong)] text-xs font-mono uppercase tracking-[0.18em] text-[var(--muted)] border-b border-[var(--panel-border)]">
                      <th className="px-4 py-3">Teste</th>
                      <th className="px-4 py-3">Grupo</th>
                      <th className="px-4 py-3">Unidade</th>
                      <th className="px-4 py-3">Descrição</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTests.length > 0 ? (
                      filteredTests.map((item: any) => (
                        <tr key={item.id} className="border-b border-[var(--panel-border)] hover:bg-white/2 transition">
                          <td className="px-4 py-3 font-semibold text-white">{item.name}</td>
                          <td className="px-4 py-3 text-xs">{item.test_group || "-"}</td>
                          <td className="px-4 py-3 text-xs">{item.default_unit || "-"}</td>
                          <td className="px-4 py-3 text-xs max-w-xs truncate">{item.description || "-"}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center text-[var(--muted)]">
                          Nenhum teste cadastrado.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Tab: Model Board Associations */}
            {activeTab === "vinculos-modelo-placa" && (
              <div className="overflow-x-auto rounded-2xl border border-[var(--panel-border)]">
                <table className="w-full text-left text-sm text-[var(--foreground)] border-collapse">
                  <thead>
                    <tr className="bg-[var(--background-strong)] text-xs font-mono uppercase tracking-[0.18em] text-[var(--muted)] border-b border-[var(--panel-border)]">
                      <th className="px-4 py-3">Modelo</th>
                      <th className="px-4 py-3">Placa</th>
                      <th className="px-4 py-3">Função / Posição</th>
                      <th className="px-4 py-3">Principal?</th>
                      <th className="px-4 py-3">Observação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredModelBoards.length > 0 ? (
                      filteredModelBoards.map((item: any) => (
                        <tr key={item.id} className="border-b border-[var(--panel-border)] hover:bg-white/2 transition">
                          <td className="px-4 py-3 font-semibold text-white">{item.equipment_models?.model_name ?? "N/A"}</td>
                          <td className="px-4 py-3 font-mono font-semibold text-[var(--accent-copper)]">{item.boards?.board_code ?? "N/A"}</td>
                          <td className="px-4 py-3">{item.role_label}</td>
                          <td className="px-4 py-3 text-xs">
                            <span className={`px-2 py-0.5 rounded-full font-semibold text-[10px] ${
                              item.is_primary 
                                ? "bg-[rgba(45,139,130,0.14)] text-[var(--accent-teal)]" 
                                : "bg-white/5 text-[var(--muted)]"
                            }`}>
                              {item.is_primary ? "Sim" : "Não"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs max-w-xs truncate">{item.notes || "-"}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-[var(--muted)]">
                          Nenhum vínculo cadastrado.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Tab: Board Components */}
            {activeTab === "componentes-placa" && (
              <div className="overflow-x-auto rounded-2xl border border-[var(--panel-border)]">
                <table className="w-full text-left text-sm text-[var(--foreground)] border-collapse">
                  <thead>
                    <tr className="bg-[var(--background-strong)] text-xs font-mono uppercase tracking-[0.18em] text-[var(--muted)] border-b border-[var(--panel-border)]">
                      <th className="px-4 py-3">Placa</th>
                      <th className="px-4 py-3">Designador</th>
                      <th className="px-4 py-3">Comp. Mestre</th>
                      <th className="px-4 py-3">Função no circuito</th>
                      <th className="px-4 py-3">Crítico?</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredBoardComponents.length > 0 ? (
                      filteredBoardComponents.map((item: any) => (
                        <tr key={item.id} className="border-b border-[var(--panel-border)] hover:bg-white/2 transition">
                          <td className="px-4 py-3 font-mono font-semibold text-[var(--accent-copper)]">{item.boards?.board_code ?? "N/A"}</td>
                          <td className="px-4 py-3 font-mono font-bold text-white text-xs">{item.reference_designator}</td>
                          <td className="px-4 py-3 font-mono text-xs">{item.components?.component_ref ?? "N/A"} ({item.components?.component_type ?? "N/A"})</td>
                          <td className="px-4 py-3 text-xs">{item.circuit_function || "-"}</td>
                          <td className="px-4 py-3 text-xs">
                            <span className={`px-2 py-0.5 rounded-full font-semibold text-[10px] ${
                              item.is_critical 
                                ? "bg-[rgba(202,106,85,0.14)] text-[var(--danger)]" 
                                : "bg-white/5 text-[var(--muted)]"
                            }`}>
                              {item.is_critical ? "Crítico" : "Padrão"}
                            </span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-[var(--muted)]">
                          Nenhum componente vinculado a placa.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Tab: Categories & Manufacturers */}
            {activeTab === "categorias" && (
              <div>
                <h4 className="text-md font-semibold text-white mb-2 font-mono uppercase tracking-wider text-xs">Categorias</h4>
                <div className="rounded-2xl border border-[var(--panel-border)] overflow-hidden">
                  <table className="w-full text-left text-sm text-[var(--foreground)] border-collapse">
                    <thead>
                      <tr className="bg-[var(--background-strong)] text-xs font-mono uppercase tracking-wider text-[var(--muted)] border-b border-[var(--panel-border)]">
                        <th className="px-3 py-2">Nome</th>
                        <th className="px-3 py-2">Slug</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredCategories.map((item: any) => (
                        <tr key={item.id} className="border-b border-[var(--panel-border)] hover:bg-white/2 transition">
                          <td className="px-3 py-2 font-semibold text-white">{item.name}</td>
                          <td className="px-3 py-2 font-mono text-xs">{item.slug}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === "fabricantes" && (
              <div className="grid gap-6 md:grid-cols-2">
                <div>
                  <h4 className="text-md font-semibold text-white mb-2 font-mono uppercase tracking-wider text-xs">Fabricantes</h4>
                  <div className="rounded-2xl border border-[var(--panel-border)] overflow-hidden">
                    <table className="w-full text-left text-sm text-[var(--foreground)] border-collapse">
                      <thead>
                        <tr className="bg-[var(--background-strong)] text-xs font-mono uppercase tracking-wider text-[var(--muted)] border-b border-[var(--panel-border)]">
                          <th className="px-3 py-2">Nome</th>
                          <th className="px-3 py-2">País</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredManufacturers.map((item: any) => (
                          <tr key={item.id} className="border-b border-[var(--panel-border)] hover:bg-white/2 transition">
                            <td className="px-3 py-2 font-semibold text-white">{item.name}</td>
                            <td className="px-3 py-2 text-xs">{item.country || "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "tipos-de-placa" && (
              <div className="grid gap-6 md:grid-cols-2">
                <div>
                  <h4 className="text-md font-semibold text-white mb-2 font-mono uppercase tracking-wider text-xs">Tipos de placa</h4>
                  <div className="rounded-2xl border border-[var(--panel-border)] overflow-hidden">
                    <table className="w-full text-left text-sm text-[var(--foreground)] border-collapse">
                      <thead>
                        <tr className="bg-[var(--background-strong)] text-xs font-mono uppercase tracking-wider text-[var(--muted)] border-b border-[var(--panel-border)]">
                          <th className="px-3 py-2">Nome</th>
                          <th className="px-3 py-2">Slug</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredBoardTypes.map((item: any) => (
                          <tr key={item.id} className="border-b border-[var(--panel-border)] hover:bg-white/2 transition">
                            <td className="px-3 py-2 font-semibold text-white">{item.name}</td>
                            <td className="px-3 py-2 text-xs font-mono">{item.slug || "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "__legacy_removed__" && (
              <div className="grid gap-6 md:grid-cols-2">
                <div>
                  <h4 className="text-md font-semibold text-white mb-2 font-mono uppercase tracking-wider text-xs">Fabricantes</h4>
                  <div className="rounded-2xl border border-[var(--panel-border)] overflow-hidden">
                    <table className="w-full text-left text-sm text-[var(--foreground)] border-collapse">
                      <thead>
                        <tr className="bg-[var(--background-strong)] text-xs font-mono uppercase tracking-wider text-[var(--muted)] border-b border-[var(--panel-border)]">
                          <th className="px-3 py-2">Nome</th>
                          <th className="px-3 py-2">País</th>
                        </tr>
                      </thead>
                      <tbody>
                        {manufacturers.map((item: any) => (
                          <tr key={item.id} className="border-b border-[var(--panel-border)] hover:bg-white/2 transition">
                            <td className="px-3 py-2 font-semibold text-white">{item.name}</td>
                            <td className="px-3 py-2 text-xs">{item.country || "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* Form Section (Register New) */}
          <aside className="rounded-[30px] border border-[var(--panel-border)] bg-[var(--panel)] p-4 sm:p-6 text-white shadow-xl flex flex-col gap-4 self-start">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.24em] text-[rgba(255,245,236,0.56)]">
                Gerenciamento
              </p>
              <h3 className="mt-1 font-[family-name:var(--font-heading)] text-2xl font-semibold tracking-tight">
                Cadastrar item
              </h3>
              <p className="text-xs text-[var(--muted)] mt-1">
                Adicione um novo registro no catálogo do domínio mestre.
              </p>
            </div>

            {/* Form: Models */}
            {activeTab === "modelos" && (
              <form action={createModelAction} className="flex flex-col gap-4">
                <label className="grid gap-2 text-sm">
                  <span className="font-medium">Categoria *</span>
                  <select
                    required
                    name="equipment_category_id"
                    className="w-full rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 outline-none"
                  >
                    <option value="">Selecione</option>
                    {categories.map((c: any) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="grid gap-2 text-sm">
                  <span className="font-medium">Fabricante *</span>
                  <select
                    required
                    name="manufacturer_id"
                    className="w-full rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 outline-none"
                  >
                    <option value="">Selecione</option>
                    {manufacturers.map((m: any) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="grid gap-2 text-sm">
                  <span className="font-medium">Nome do Modelo *</span>
                  <input
                    required
                    type="text"
                    name="model_name"
                    placeholder="Ex.: UN50AU7700"
                    className="w-full rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 outline-none"
                  />
                </label>

                <label className="grid gap-2 text-sm">
                  <span className="font-medium">Família comercial</span>
                  <input
                    type="text"
                    name="family_name"
                    placeholder="Ex.: AU7700"
                    className="w-full rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 outline-none"
                  />
                </label>

                <label className="grid gap-2 text-sm">
                  <span className="font-medium">Identificador de revisão</span>
                  <input
                    type="text"
                    name="revision_label"
                    placeholder="Ex.: v1.2, REV0"
                    className="w-full rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 outline-none"
                  />
                </label>

                <label className="grid gap-2 text-sm">
                  <span className="font-medium">Notas adicionais</span>
                  <textarea
                    name="release_notes"
                    rows={3}
                    placeholder="Detalhes sobre placa padrão, tela, etc."
                    className="w-full rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 outline-none"
                  />
                </label>

                <button className="w-full rounded-full bg-[var(--accent-copper)] py-3 text-sm font-semibold text-white shadow-md hover:-translate-y-0.5 transition">
                  Cadastrar Modelo
                </button>
              </form>
            )}

            {/* Form: Boards */}
            {activeTab === "placas" && (
              <form action={createBoardAction} className="flex flex-col gap-4">
                <label className="grid gap-2 text-sm">
                  <span className="font-medium">Tipo de Placa *</span>
                  <select
                    required
                    name="board_type_id"
                    className="w-full rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 outline-none"
                  >
                    <option value="">Selecione</option>
                    {boardTypes.map((b: any) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="grid gap-2 text-sm">
                  <span className="font-medium">Fabricante</span>
                  <select
                    name="manufacturer_id"
                    className="w-full rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 outline-none"
                  >
                    <option value="">Selecione se souber</option>
                    {manufacturers.map((m: any) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="grid gap-2 text-sm">
                  <span className="font-medium">Código da Placa *</span>
                  <input
                    required
                    type="text"
                    name="board_code"
                    placeholder="Ex.: BN41-02568A, LDD.335A"
                    className="w-full rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 outline-none"
                  />
                </label>

                <label className="grid gap-2 text-sm">
                  <span className="font-medium">Revisão</span>
                  <input
                    type="text"
                    name="board_revision"
                    placeholder="Ex.: Rev 1.0, a, b"
                    className="w-full rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 outline-none"
                  />
                </label>

                <label className="grid gap-2 text-sm">
                  <span className="font-medium">Descrição</span>
                  <textarea
                    name="description"
                    rows={3}
                    placeholder="Para que modelos serve ou circuito principal."
                    className="w-full rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 outline-none"
                  />
                </label>

                <button className="w-full rounded-full bg-[var(--accent-copper)] py-3 text-sm font-semibold text-white shadow-md hover:-translate-y-0.5 transition">
                  Cadastrar Placa
                </button>
              </form>
            )}

            {/* Form: Components */}
            {activeTab === "componentes" && (
              <form action={createComponentAction} className="flex flex-col gap-4">
                <label className="grid gap-2 text-sm">
                  <span className="font-medium">Código / Referência *</span>
                  <input
                    required
                    type="text"
                    name="component_ref"
                    placeholder="Ex.: NE555, MP2307, AO4407"
                    className="w-full rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 outline-none"
                  />
                </label>

                <label className="grid gap-2 text-sm">
                  <span className="font-medium">Tipo de Componente *</span>
                  <input
                    required
                    type="text"
                    name="component_type"
                    placeholder="Ex.: CI PWM, Mosfet N-Channel, Diodo"
                    className="w-full rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 outline-none"
                  />
                </label>

                <label className="grid gap-2 text-sm">
                  <span className="font-medium">MPN (Manufacturer Part Number)</span>
                  <input
                    type="text"
                    name="manufacturer_part_number"
                    placeholder="Ex.: AO4407A"
                    className="w-full rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 outline-none"
                  />
                </label>

                <label className="grid gap-2 text-sm">
                  <span className="font-medium">GPN (Generic Part Number)</span>
                  <input
                    type="text"
                    name="generic_part_number"
                    placeholder="Ex.: AO4407"
                    className="w-full rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 outline-none"
                  />
                </label>

                <label className="grid gap-2 text-sm">
                  <span className="font-medium">Tipo de Invólucro (Package)</span>
                  <input
                    type="text"
                    name="package_type"
                    placeholder="Ex.: SOIC-8, SOT-23, TO-220"
                    className="w-full rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 outline-none"
                  />
                </label>

                <label className="grid gap-2 text-sm">
                  <span className="font-medium">Descrição</span>
                  <textarea
                    name="description"
                    rows={2}
                    placeholder="Ex.: Mosfet Canal P 30V 12A"
                    className="w-full rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 outline-none"
                  />
                </label>

                <label className="grid gap-2 text-sm">
                  <span className="font-medium">Resumo do Datasheet (valores limiares)</span>
                  <textarea
                    name="datasheet_summary"
                    rows={2}
                    placeholder="Ex.: Vds: -30V, Vgs: 20V, Rds: 13mOhm"
                    className="w-full rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 outline-none"
                  />
                </label>

                <button className="w-full rounded-full bg-[var(--accent-copper)] py-3 text-sm font-semibold text-white shadow-md hover:-translate-y-0.5 transition">
                  Cadastrar Componente
                </button>
              </form>
            )}

            {activeTab === "sintomas" && (
              <form action={createSymptomAction} className="flex flex-col gap-4">
                <label className="grid gap-2 text-sm">
                  <span className="font-medium">Categoria *</span>
                  <select
                    required
                    name="equipment_category_id"
                    className="w-full rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 outline-none"
                  >
                    <option value="">Selecione</option>
                    {categories.map((c: any) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="grid gap-2 text-sm">
                  <span className="font-medium">Nome do sintoma *</span>
                  <input
                    required
                    type="text"
                    name="name"
                    placeholder="Ex.: Não liga, sem imagem, sem áudio"
                    className="w-full rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 outline-none"
                  />
                </label>

                <label className="grid gap-2 text-sm">
                  <span className="font-medium">Grupo do sintoma</span>
                  <input
                    type="text"
                    name="symptom_group"
                    placeholder="Ex.: alimentação, vídeo, aquecimento"
                    className="w-full rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 outline-none"
                  />
                </label>

                <label className="grid gap-2 text-sm">
                  <span className="font-medium">Descrição</span>
                  <textarea
                    name="description"
                    rows={3}
                    placeholder="Detalhes para ajudar a equipe a usar esse sintoma."
                    className="w-full rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 outline-none"
                  />
                </label>

                <button className="w-full rounded-full bg-[var(--accent-copper)] py-3 text-sm font-semibold text-white shadow-md hover:-translate-y-0.5 transition">
                  Cadastrar Sintoma
                </button>
              </form>
            )}

            {activeTab === "testes" && (
              <form action={createTestAction} className="flex flex-col gap-4">
                <label className="grid gap-2 text-sm">
                  <span className="font-medium">Nome do teste *</span>
                  <input
                    required
                    type="text"
                    name="name"
                    placeholder="Ex.: Medir tensão de standby"
                    className="w-full rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 outline-none"
                  />
                </label>

                <label className="grid gap-2 text-sm">
                  <span className="font-medium">Grupo do teste</span>
                  <input
                    type="text"
                    name="test_group"
                    placeholder="Ex.: alimentação, vídeo, BIOS"
                    className="w-full rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 outline-none"
                  />
                </label>

                <label className="grid gap-2 text-sm">
                  <span className="font-medium">Unidade padrão</span>
                  <input
                    type="text"
                    name="default_unit"
                    placeholder="Ex.: V, A, ohm, °C"
                    className="w-full rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 outline-none"
                  />
                </label>

                <label className="grid gap-2 text-sm">
                  <span className="font-medium">Descrição</span>
                  <textarea
                    name="description"
                    rows={3}
                    placeholder="Passo a passo ou contexto de uso do teste."
                    className="w-full rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 outline-none"
                  />
                </label>

                <button className="w-full rounded-full bg-[var(--accent-copper)] py-3 text-sm font-semibold text-white shadow-md hover:-translate-y-0.5 transition">
                  Cadastrar Teste
                </button>
              </form>
            )}

            {/* Form: Model Board Associations */}
            {activeTab === "vinculos-modelo-placa" && (
              <form action={createModelBoardAction} className="flex flex-col gap-4">
                <label className="grid gap-2 text-sm">
                  <span className="font-medium">Modelo *</span>
                  <select
                    required
                    name="equipment_model_id"
                    className="w-full rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 outline-none"
                  >
                    <option value="">Selecione</option>
                    {models.map((m: any) => (
                      <option key={m.id} value={m.id}>
                        {m.model_name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="grid gap-2 text-sm">
                  <span className="font-medium">Placa *</span>
                  <select
                    required
                    name="board_id"
                    className="w-full rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 outline-none"
                  >
                    <option value="">Selecione</option>
                    {boards.map((b: any) => (
                      <option key={b.id} value={b.id}>
                        {b.board_code}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="grid gap-2 text-sm">
                  <span className="font-medium">Função / Posição na montagem *</span>
                  <input
                    required
                    type="text"
                    name="role_label"
                    placeholder="Ex.: Placa Principal, Fonte, Placa T-Con"
                    className="w-full rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 outline-none"
                  />
                </label>

                <label className="flex items-center gap-3 text-sm mt-1 cursor-pointer">
                  <input
                    type="checkbox"
                    name="is_primary"
                    className="h-4 w-4 rounded border-white/10 bg-white/5 text-[var(--accent-copper)] focus:ring-0"
                  />
                  <span>Esta é a placa principal?</span>
                </label>

                <label className="grid gap-2 text-sm">
                  <span className="font-medium">Observações</span>
                  <textarea
                    name="notes"
                    rows={2}
                    placeholder="Ex.: Placa usada em televisores série AU7700 de 50 polegadas."
                    className="w-full rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 outline-none"
                  />
                </label>

                <button className="w-full rounded-full bg-[var(--accent-copper)] py-3 text-sm font-semibold text-white shadow-md hover:-translate-y-0.5 transition">
                  Vincular Modelo e Placa
                </button>
              </form>
            )}

            {/* Form: Board Components */}
            {activeTab === "componentes-placa" && (
              <form action={createBoardComponentAction} className="flex flex-col gap-4">
                <label className="grid gap-2 text-sm">
                  <span className="font-medium">Placa *</span>
                  <select
                    required
                    name="board_id"
                    className="w-full rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 outline-none"
                  >
                    <option value="">Selecione</option>
                    {boards.map((b: any) => (
                      <option key={b.id} value={b.id}>
                        {b.board_code}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="grid gap-2 text-sm">
                  <span className="font-medium">Componente Mestre *</span>
                  <select
                    required
                    name="component_id"
                    className="w-full rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 outline-none"
                  >
                    <option value="">Selecione</option>
                    {components.map((c: any) => (
                      <option key={c.id} value={c.id}>
                        {c.component_ref} ({c.component_type})
                      </option>
                    ))}
                  </select>
                </label>

                <label className="grid gap-2 text-sm">
                  <span className="font-medium">Designador de referência na Placa *</span>
                  <input
                    required
                    type="text"
                    name="reference_designator"
                    placeholder="Ex.: U3201, Q501, R102, C11"
                    className="w-full rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 outline-none font-mono"
                  />
                </label>

                <label className="grid gap-2 text-sm">
                  <span className="font-medium">Função no Circuito</span>
                  <input
                    type="text"
                    name="circuit_function"
                    placeholder="Ex.: Conversor Buck de 3.3V, Chaveador de alta"
                    className="w-full rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 outline-none"
                  />
                </label>

                <label className="grid gap-2 text-sm">
                  <span className="font-medium">Comportamento esperado</span>
                  <textarea
                    name="expected_behavior"
                    rows={2}
                    placeholder="Ex.: Entrada 5V, Saída 3.3V estável"
                    className="w-full rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 outline-none"
                  />
                </label>

                <label className="flex items-center gap-3 text-sm mt-1 cursor-pointer">
                  <input
                    type="checkbox"
                    name="is_critical"
                    className="h-4 w-4 rounded border-white/10 bg-white/5 text-[var(--accent-copper)] focus:ring-0"
                  />
                  <span>Este componente é crítico / quebra fácil?</span>
                </label>

                <button className="w-full rounded-full bg-[var(--accent-copper)] py-3 text-sm font-semibold text-white shadow-md hover:-translate-y-0.5 transition">
                  Vincular Componente à Placa
                </button>
              </form>
            )}

            {/* Form: General Parameters (Categories & Manufacturers) */}
            {activeTab === "categorias" && (
              <form action={createCategoryAction} className="flex flex-col gap-4">
                <h4 className="text-sm font-bold font-mono uppercase tracking-wider text-white">Criar Categoria</h4>

                <label className="grid gap-2 text-sm">
                  <span className="font-medium">Nome da Categoria *</span>
                  <input
                    required
                    type="text"
                    name="name"
                    placeholder="Ex.: Game Console, Projetor"
                    className="w-full rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 outline-none"
                  />
                </label>

                <label className="grid gap-2 text-sm">
                  <span className="font-medium">Descrição</span>
                  <textarea
                    name="description"
                    rows={2}
                    placeholder="Contexto geral da categoria."
                    className="w-full rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 outline-none"
                  />
                </label>

                <button className="w-full rounded-full bg-[var(--accent-teal)] py-3 text-sm font-semibold text-white shadow-md hover:-translate-y-0.5 transition">
                  Criar Categoria
                </button>
              </form>
            )}

            {activeTab === "fabricantes" && (
              <form action={createManufacturerAction} className="flex flex-col gap-4">
                <h4 className="text-sm font-bold font-mono uppercase tracking-wider text-white">Criar Fabricante</h4>

                <label className="grid gap-2 text-sm">
                  <span className="font-medium">Nome da Marca *</span>
                  <input
                    required
                    type="text"
                    name="name"
                    placeholder="Ex.: Sony, Philips"
                    className="w-full rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 outline-none"
                  />
                </label>

                <label className="grid gap-2 text-sm">
                  <span className="font-medium">País de origem</span>
                  <input
                    type="text"
                    name="country"
                    placeholder="Ex.: Japão, Holanda"
                    className="w-full rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 outline-none"
                  />
                </label>

                <label className="grid gap-2 text-sm">
                  <span className="font-medium">Observações</span>
                  <textarea
                    name="notes"
                    rows={2}
                    placeholder="Informações adicionais do fabricante."
                    className="w-full rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 outline-none"
                  />
                </label>

                <button className="w-full rounded-full bg-[var(--accent-teal)] py-3 text-sm font-semibold text-white shadow-md hover:-translate-y-0.5 transition">
                  Criar Fabricante
                </button>
              </form>
            )}

            {activeTab === "tipos-de-placa" && (
              <form action={createBoardTypeAction} className="flex flex-col gap-4">
                <h4 className="text-sm font-bold font-mono uppercase tracking-wider text-white">Criar Tipo de Placa</h4>

                <label className="grid gap-2 text-sm">
                  <span className="font-medium">Nome do tipo *</span>
                  <input
                    required
                    type="text"
                    name="name"
                    placeholder="Ex.: Placa-mãe, Fonte, T-Con"
                    className="w-full rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 outline-none"
                  />
                </label>

                <label className="grid gap-2 text-sm">
                  <span className="font-medium">Descrição</span>
                  <textarea
                    name="description"
                    rows={2}
                    placeholder="Quando esse tipo deve ser usado no catálogo."
                    className="w-full rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 outline-none"
                  />
                </label>

                <button className="w-full rounded-full bg-[var(--accent-teal)] py-3 text-sm font-semibold text-white shadow-md hover:-translate-y-0.5 transition">
                  Criar Tipo de Placa
                </button>
              </form>
            )}

            {activeTab === "__legacy_removed__" && (
              <div className="flex flex-col gap-6">
                <form action={createManufacturerAction} className="flex flex-col gap-4">
                  <h4 className="text-sm font-bold font-mono uppercase tracking-wider text-white">Criar Fabricante</h4>

                  <label className="grid gap-2 text-sm">
                    <span className="font-medium">Nome da Marca *</span>
                    <input
                      required
                      type="text"
                      name="name"
                      placeholder="Ex.: Sony, Philips"
                      className="w-full rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 outline-none"
                    />
                  </label>

                  <label className="grid gap-2 text-sm">
                    <span className="font-medium">País de origem</span>
                    <input
                      type="text"
                      name="country"
                      placeholder="Ex.: Japão, Holanda"
                      className="w-full rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 outline-none"
                    />
                  </label>

                  <label className="grid gap-2 text-sm">
                    <span className="font-medium">Observações</span>
                    <textarea
                      name="notes"
                      rows={2}
                      placeholder="Informações adicionais do fabricante."
                      className="w-full rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 outline-none"
                    />
                  </label>

                  <button className="w-full rounded-full bg-[var(--accent-teal)] py-3 text-sm font-semibold text-white shadow-md hover:-translate-y-0.5 transition">
                    Criar Fabricante
                  </button>
                </form>
              </div>
            )}
          </aside>
        </div>
      </div>
    </AppShell>
  );
}
