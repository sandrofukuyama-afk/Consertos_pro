import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { requireCurrentUser } from "@/lib/auth";
import { getSettingsDashboardData } from "@/lib/services/settings";
import { formatRelativeTime } from "@/lib/utils";
import { updateTechnicianProfileAction } from "./actions";

type SettingsPageProps = {
  searchParams: Promise<{
    tab?: string;
    error?: string;
    success?: string;
    editProfileId?: string;
  }>;
};

export default async function ConfiguracoesPage({ searchParams }: SettingsPageProps) {
  const user = await requireCurrentUser();
  const params = await searchParams;

  const activeTab = params.tab || "tecnicos";
  const error = params.error || null;
  const success = params.success || null;
  const editProfileId = params.editProfileId || null;

  const { profiles, history, reviews } = await getSettingsDashboardData();

  const profileToEdit = editProfileId
    ? profiles.find((p) => p.id === editProfileId)
    : null;

  const tabs = [
    { id: "tecnicos", label: "Técnicos & Acessos" },
    { id: "auditoria", label: "Histórico de Auditoria & Revisões" },
  ];

  return (
    <AppShell
      title="Configurações e acessos"
      description="Gerencie os usuários do sistema, configure especialidades dos técnicos e audite o histórico de alterações."
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
                href={`/configuracoes?tab=${tab.id}`}
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

        {/* Page Content Grid */}
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.9fr)]">
          {/* Main List Section */}
          <section className="rounded-[30px] border border-[var(--panel-border)] bg-[var(--card-surface)] p-4 sm:p-6 shadow-[0_18px_44px_rgba(72,62,49,0.06)] flex flex-col gap-4 self-start">
            {/* Tab: Technicians */}
            {activeTab === "tecnicos" && (
              <div className="flex flex-col gap-4">
                <div className="pb-3 border-b border-[var(--panel-border)]">
                  <h3 className="text-xl font-semibold text-white">Técnicos da Oficina</h3>
                  <p className="text-sm text-[var(--muted)] mt-1">
                    Lista de perfis cadastrados no sistema e suas especialidades.
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  {profiles.length > 0 ? (
                    profiles.map((profile) => {
                      const initial = profile.display_name.charAt(0).toUpperCase();
                      return (
                        <article
                          key={profile.id}
                          className="rounded-[24px] border border-[var(--panel-border)] bg-[var(--background)] p-5 flex flex-col gap-3 justify-between hover:border-[rgba(184,109,60,0.3)] transition"
                        >
                          <div className="flex items-start gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--accent-copper)] text-sm font-semibold text-white shadow-sm">
                              {initial}
                            </div>
                            <div className="min-w-0 flex-1">
                              <h4 className="text-sm font-semibold text-white truncate">
                                {profile.display_name}
                              </h4>
                              <p className="text-xs text-[var(--muted)] truncate">
                                {profile.users?.email ?? "Sem email"}
                              </p>
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                                  profile.is_reviewer
                                    ? "bg-[rgba(45,139,130,0.14)] text-[var(--accent-teal)]"
                                    : "bg-[rgba(184,109,60,0.14)] text-[var(--accent-copper)]"
                                }`}>
                                  {profile.is_reviewer ? "Revisor Técnico" : "Técnico"}
                                </span>
                                <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                                  profile.users?.status === "active"
                                    ? "bg-[rgba(62,158,114,0.14)] text-[var(--success)]"
                                    : "bg-white/5 text-[var(--muted)]"
                                }`}>
                                  {profile.users?.status === "active" ? "Ativo" : "Inativo"}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="border-t border-white/5 pt-3">
                            <p className="text-xs font-mono text-[var(--muted)] uppercase tracking-wider">
                              Especialidades:
                            </p>
                            <p className="text-sm text-white/90 mt-1 line-clamp-2">
                              {profile.specialties_summary || "Geral / Bancada ampla"}
                            </p>
                            {profile.notes && (
                              <p className="text-xs text-[var(--muted)] mt-1.5 italic line-clamp-1">
                                "{profile.notes}"
                              </p>
                            )}
                          </div>

                          <div className="pt-2 border-t border-white/5 flex justify-end">
                            <Link
                              href={`/configuracoes?tab=tecnicos&editProfileId=${profile.id}`}
                              className="text-xs font-semibold text-[var(--accent-copper)] hover:text-white transition"
                            >
                              Editar Perfil
                            </Link>
                          </div>
                        </article>
                      );
                    })
                  ) : (
                    <p className="text-sm text-[var(--muted)] text-center py-6 sm:col-span-2">
                      Nenhum perfil de técnico encontrado.
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Tab: Audit Log & Reviews */}
            {activeTab === "auditoria" && (
              <div className="flex flex-col gap-6">
                {/* Audit Logs */}
                <div className="flex flex-col gap-4">
                  <div className="pb-3 border-b border-[var(--panel-border)]">
                    <h3 className="text-xl font-semibold text-white">Registro de Auditoria (Audit Log)</h3>
                    <p className="text-sm text-[var(--muted)] mt-1">
                      Últimas 50 alterações registradas nas entidades do sistema.
                    </p>
                  </div>

                  <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
                    {history.length > 0 ? (
                      history.map((log: any) => {
                        const dateLabel = formatRelativeTime(log.changed_at);
                        const changeTone =
                          log.change_type === "create"
                            ? "bg-[rgba(62,158,114,0.14)] text-[var(--success)]"
                            : log.change_type === "delete"
                              ? "bg-[rgba(202,106,85,0.14)] text-[var(--danger)]"
                              : "bg-[rgba(216,166,84,0.14)] text-[var(--accent-amber)]";

                        return (
                          <div
                            key={log.id}
                            className="rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] p-4 flex flex-col gap-2 hover:border-white/10 transition"
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={`rounded-full px-2 py-0.5 text-[10px] font-mono font-semibold uppercase ${changeTone}`}>
                                  {log.change_type}
                                </span>
                                <span className="text-xs font-mono font-semibold text-white">
                                  {log.entity_type}
                                </span>
                                <span className="text-xs text-[var(--muted)]">
                                  (ID: {log.entity_id.slice(0, 8).toUpperCase()})
                                </span>
                              </div>
                              <span className="text-xs font-mono text-[var(--muted)] whitespace-nowrap">
                                {dateLabel}
                              </span>
                            </div>

                            <p className="text-sm text-white/90">
                              <span className="text-xs text-[var(--muted)] uppercase font-mono mr-1">
                                Alterado por:
                              </span>
                              {log.users?.full_name ?? "Sistema"}
                            </p>

                            {log.field_name && (
                              <p className="text-xs font-mono text-[var(--muted)] bg-white/2 rounded-md p-1.5 border border-white/5 break-words">
                                Campos: {log.field_name}
                                {log.new_value_text && ` ➔ Novo valor: ${log.new_value_text}`}
                              </p>
                            )}

                            {log.change_reason && (
                              <p className="text-xs text-[var(--muted)] italic">
                                Motivo: {log.change_reason}
                              </p>
                            )}
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-sm text-[var(--muted)] text-center py-6">
                        Nenhuma alteração registrada no histórico.
                      </p>
                    )}
                  </div>
                </div>

                {/* Entity Reviews */}
                <div className="flex flex-col gap-4 border-t border-[var(--panel-border)] pt-6">
                  <div className="pb-3 border-b border-[var(--panel-border)]">
                    <h3 className="text-xl font-semibold text-white">Revisões de Conhecimento</h3>
                    <p className="text-sm text-[var(--muted)] mt-1">
                      Status das aprovações formais de soluções e causas promovidas.
                    </p>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    {reviews.length > 0 ? (
                      reviews.map((review: any) => {
                        const dateLabel = formatRelativeTime(review.reviewed_at);
                        const statusTone =
                          review.review_status === "approved"
                            ? "bg-[rgba(62,158,114,0.14)] text-[var(--success)]"
                            : review.review_status === "rejected"
                              ? "bg-[rgba(202,106,85,0.14)] text-[var(--danger)]"
                              : "bg-[rgba(216,166,84,0.14)] text-[var(--accent-amber)]";

                        return (
                          <article
                            key={review.id}
                            className="rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] p-4 flex flex-col gap-2"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-semibold text-white font-mono uppercase tracking-wider">
                                {review.entity_type}
                              </span>
                              <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase ${statusTone}`}>
                                {review.review_status}
                              </span>
                            </div>
                            <p className="text-xs text-[var(--muted)]">
                              ID da entidade: {review.entity_id.slice(0, 8).toUpperCase()}
                            </p>
                            <div className="border-t border-white/5 pt-2 mt-1">
                              <p className="text-xs text-[var(--muted)] leading-relaxed">
                                Notas: {review.review_notes || "Sem observações registradas."}
                              </p>
                              <p className="text-[10px] text-[var(--muted)] font-mono mt-2 text-right">
                                Por {review.users?.full_name ?? "Revisor"} • {dateLabel}
                              </p>
                            </div>
                          </article>
                        );
                      })
                    ) : (
                      <p className="text-sm text-[var(--muted)] text-center py-6 sm:col-span-2">
                        Nenhuma revisão de conhecimento registrada ainda.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* Right Aside: Profile Editor or Overview */}
          <aside className="rounded-[30px] border border-[var(--panel-border)] bg-[var(--panel)] p-4 sm:p-6 text-white shadow-xl flex flex-col gap-4 self-start">
            {activeTab === "tecnicos" && profileToEdit ? (
              <div className="flex flex-col gap-4">
                <div>
                  <p className="font-mono text-xs uppercase tracking-[0.24em] text-[var(--accent-copper)]">
                    Edição de Perfil
                  </p>
                  <h3 className="mt-1 text-2xl font-semibold tracking-tight text-white">
                    Editar Técnico
                  </h3>
                  <p className="text-xs text-[var(--muted)] mt-1">
                    Atualize as especialidades e permissões do técnico selecionado.
                  </p>
                </div>

                <form action={updateTechnicianProfileAction} className="flex flex-col gap-4">
                  <input type="hidden" name="profile_id" value={profileToEdit.id} />

                  <label className="grid gap-2 text-sm">
                    <span className="font-medium text-[var(--muted)]">Nome de Exibição</span>
                    <input
                      disabled
                      type="text"
                      value={profileToEdit.display_name}
                      className="w-full rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 outline-none opacity-60 text-white"
                    />
                  </label>

                  <label className="grid gap-2 text-sm">
                    <span className="font-medium text-[var(--muted)]">E-mail</span>
                    <input
                      disabled
                      type="text"
                      value={profileToEdit.users?.email ?? ""}
                      className="w-full rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 outline-none opacity-60 text-white"
                    />
                  </label>

                  <label className="grid gap-2 text-sm">
                    <span className="font-medium">Resumo de Especialidades *</span>
                    <input
                      required
                      type="text"
                      name="specialties_summary"
                      defaultValue={profileToEdit.specialties_summary || ""}
                      placeholder="Ex.: TVs LG/Samsung, Reparo de placas SMD, BIOS"
                      className="w-full rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 outline-none text-white"
                    />
                  </label>

                  <label className="grid gap-2 text-sm">
                    <span className="font-medium">Notas operacionais</span>
                    <textarea
                      name="notes"
                      rows={3}
                      defaultValue={profileToEdit.notes || ""}
                      placeholder="Observações internas sobre o perfil."
                      className="w-full rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 outline-none text-white"
                    />
                  </label>

                  <label className="flex items-center gap-3 text-sm mt-1 cursor-pointer">
                    <input
                      type="checkbox"
                      name="is_reviewer"
                      defaultChecked={profileToEdit.is_reviewer}
                      className="h-4 w-4 rounded border-white/10 bg-white/5 text-[var(--accent-copper)] focus:ring-0"
                    />
                    <span>Ativar como Revisor Técnico</span>
                  </label>

                  <div className="flex gap-3 pt-2">
                    <button
                      type="submit"
                      className="flex-1 rounded-full bg-[var(--accent-copper)] py-3 text-sm font-semibold text-white shadow-md hover:-translate-y-0.5 transition"
                    >
                      Salvar Alterações
                    </button>
                    <Link
                      href="/configuracoes?tab=tecnicos"
                      className="rounded-full border border-[var(--panel-border)] px-5 py-3 text-center text-sm font-semibold text-white hover:bg-white/5 transition"
                    >
                      Cancelar
                    </Link>
                  </div>
                </form>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <div>
                  <p className="font-mono text-xs uppercase tracking-[0.24em] text-[rgba(255,245,236,0.56)]">
                    Resumo do Sistema
                  </p>
                  <h3 className="mt-1 font-[family-name:var(--font-heading)] text-2xl font-semibold tracking-tight text-white">
                    Status Operacional
                  </h3>
                  <p className="text-xs text-[var(--muted)] mt-1">
                    Indicadores globais de configuração e auditoria.
                  </p>
                </div>

                <div className="grid gap-4 mt-2">
                  <div className="rounded-2xl border border-white/5 bg-white/3 p-4">
                    <p className="font-mono text-[10px] uppercase tracking-wider text-[var(--muted)]">Técnicos Cadastrados</p>
                    <p className="text-3xl font-semibold mt-1 text-white">{profiles.length}</p>
                    <p className="text-xs text-[var(--muted)] mt-1">
                      {profiles.filter((p) => p.is_reviewer).length} revisores técnicos autorizados.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-white/5 bg-white/3 p-4">
                    <p className="font-mono text-[10px] uppercase tracking-wider text-[var(--muted)]">Log de Auditoria</p>
                    <p className="text-3xl font-semibold mt-1 text-[var(--accent-copper)]">{history.length}</p>
                    <p className="text-xs text-[var(--muted)] mt-1">Modificações salvas na base atual.</p>
                  </div>

                  <div className="rounded-2xl border border-white/5 bg-white/3 p-4">
                    <p className="font-mono text-[10px] uppercase tracking-wider text-[var(--muted)]">Revisões de Conhecimento</p>
                    <p className="text-3xl font-semibold mt-1 text-[var(--accent-teal)]">{reviews.length}</p>
                    <p className="text-xs text-[var(--muted)] mt-1">Casos avaliados e promovidos por revisores.</p>
                  </div>
                </div>

                {activeTab === "tecnicos" && (
                  <div className="rounded-2xl border border-[rgba(184,109,60,0.22)] bg-[rgba(184,109,60,0.06)] p-4 text-xs text-[rgba(255,245,236,0.72)] leading-5">
                    💡 <strong className="text-white">Dica:</strong> Clique em "Editar Perfil" no card de qualquer técnico na lista para atualizar especialidades ou ativá-lo como revisor técnico.
                  </div>
                )}

                {activeTab === "auditoria" && (
                  <div className="rounded-2xl border border-[rgba(45,139,130,0.22)] bg-[rgba(45,139,130,0.06)] p-4 text-xs text-[rgba(255,245,236,0.72)] leading-5">
                    🛡️ <strong className="text-white">Segurança:</strong> O registro de alterações é imutável e acompanha toda inserção, edição ou exclusão de dados operacionais ou de catálogo técnico na oficina.
                  </div>
                )}
              </div>
            )}
          </aside>
        </div>
      </div>
    </AppShell>
  );
}
