import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { DeleteTechnicianButton } from "@/components/delete-technician-button";
import { requireCurrentUser } from "@/lib/auth";
import { getSettingsDashboardData } from "@/lib/services/settings";
import { formatRelativeTime } from "@/lib/utils";
import {
  createTechnicianAccessAction,
  updateTechnicianProfileAction,
} from "./actions";

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
  const profileToEdit = editProfileId ? profiles.find((profile) => profile.id === editProfileId) : null;

  const tabs = [
    { id: "tecnicos", label: "Técnicos e acessos" },
    { id: "auditoria", label: "Histórico e revisões" },
  ];

  return (
    <AppShell
      title="Configurações e acessos"
      description="Gerencie usuários do sistema, ajuste perfis técnicos e acompanhe o histórico de alterações."
      user={user}
    >
      <div className="flex flex-col gap-6">
        <div className="flex gap-2 overflow-x-auto border-b border-[var(--panel-border)] pb-px scrollbar-none">
          {tabs.map((tab) => {
            const isTabActive = activeTab === tab.id;

            return (
              <Link
                key={tab.id}
                href={`/configuracoes?tab=${tab.id}`}
                className={`whitespace-nowrap rounded-t-xl border-b-2 px-4 py-2 text-sm font-semibold transition ${
                  isTabActive
                    ? "border-[var(--accent-copper)] bg-white/5 text-white"
                    : "border-transparent text-[var(--muted)] hover:border-white/20 hover:text-white"
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>

        {error ? (
          <div className="rounded-2xl border border-[rgba(202,106,85,0.28)] bg-[rgba(202,106,85,0.08)] px-4 py-3 text-sm text-[var(--danger)]">
            {error}
          </div>
        ) : null}

        {success ? (
          <div className="rounded-2xl border border-[rgba(62,158,114,0.28)] bg-[rgba(62,158,114,0.08)] px-4 py-3 text-sm text-[var(--success)]">
            {success}
          </div>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.9fr)]">
          <section className="flex flex-col gap-4 self-start rounded-[30px] border border-[var(--panel-border)] bg-[var(--card-surface)] p-4 shadow-[0_18px_44px_rgba(72,62,49,0.06)] sm:p-6">
            {activeTab === "tecnicos" ? (
              <div className="flex flex-col gap-4">
                <div className="border-b border-[var(--panel-border)] pb-3">
                  <h3 className="text-xl font-semibold text-white">Técnicos da oficina</h3>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    Lista de perfis técnicos já vinculados ao sistema.
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  {profiles.length > 0 ? (
                    profiles.map((profile) => {
                      const initial = profile.display_name.charAt(0).toUpperCase();

                      return (
                        <article
                          key={profile.id}
                          className="flex flex-col justify-between gap-3 rounded-[24px] border border-[var(--panel-border)] bg-[var(--background)] p-5 transition hover:border-[rgba(184,109,60,0.3)]"
                        >
                          <div className="flex items-start gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--accent-copper)] text-sm font-semibold text-white shadow-sm">
                              {initial}
                            </div>

                            <div className="min-w-0 flex-1">
                              <h4 className="truncate text-sm font-semibold text-white">
                                {profile.display_name}
                              </h4>
                              <p className="truncate text-xs text-[var(--muted)]">
                                {profile.users?.email ?? "Sem e-mail"}
                              </p>

                              <div className="mt-2 flex flex-wrap gap-1.5">
                                <span
                                  className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                                    profile.is_reviewer
                                      ? "bg-[rgba(45,139,130,0.14)] text-[var(--accent-teal)]"
                                      : "bg-[rgba(184,109,60,0.14)] text-[var(--accent-copper)]"
                                  }`}
                                >
                                  {profile.is_reviewer ? "Revisor técnico" : "Técnico"}
                                </span>
                                <span
                                  className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                                    profile.users?.status === "active"
                                      ? "bg-[rgba(62,158,114,0.14)] text-[var(--success)]"
                                      : "bg-white/5 text-[var(--muted)]"
                                  }`}
                                >
                                  {profile.users?.status === "active" ? "Ativo" : "Inativo"}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="border-t border-white/5 pt-3">
                            <p className="text-xs uppercase tracking-wider text-[var(--muted)]">
                              Especialidades
                            </p>
                            <p className="mt-1 text-sm text-white/90">
                              {profile.specialties_summary || "Geral / bancada ampla"}
                            </p>
                            {profile.notes ? (
                              <p className="mt-1.5 line-clamp-1 text-xs italic text-[var(--muted)]">
                                "{profile.notes}"
                              </p>
                            ) : null}
                          </div>

                          <div className="flex items-center justify-end gap-4 border-t border-white/5 pt-2">
                            <DeleteTechnicianButton profileId={profile.id} />
                            <Link
                              href={`/configuracoes?tab=tecnicos&editProfileId=${profile.id}`}
                              className="text-xs font-semibold text-[var(--accent-copper)] transition hover:text-white"
                            >
                              Editar perfil
                            </Link>
                          </div>
                        </article>
                      );
                    })
                  ) : (
                    <p className="py-6 text-center text-sm text-[var(--muted)] sm:col-span-2">
                      Nenhum perfil técnico encontrado.
                    </p>
                  )}
                </div>
              </div>
            ) : null}

            {activeTab === "auditoria" ? (
              <div className="flex flex-col gap-6">
                <div className="flex flex-col gap-4">
                  <div className="border-b border-[var(--panel-border)] pb-3">
                    <h3 className="text-xl font-semibold text-white">Registro de auditoria</h3>
                    <p className="mt-1 text-sm text-[var(--muted)]">
                      Últimas alterações registradas nas entidades do sistema.
                    </p>
                  </div>

                  <div className="max-h-[500px] space-y-4 overflow-y-auto pr-1">
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
                            className="flex flex-col gap-2 rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] p-4 transition hover:border-white/10"
                          >
                            <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${changeTone}`}>
                                  {log.change_type}
                                </span>
                                <span className="text-xs font-semibold text-white">
                                  {log.entity_type}
                                </span>
                                <span className="text-xs text-[var(--muted)]">
                                  ID: {log.entity_id.slice(0, 8).toUpperCase()}
                                </span>
                              </div>

                              <span className="whitespace-nowrap text-xs text-[var(--muted)]">
                                {dateLabel}
                              </span>
                            </div>

                            <p className="text-sm text-white/90">
                              <span className="mr-1 text-xs uppercase text-[var(--muted)]">
                                Alterado por:
                              </span>
                              {log.users?.full_name ?? "Sistema"}
                            </p>

                            {log.field_name ? (
                              <p className="break-words rounded-md border border-white/5 bg-white/2 p-1.5 text-xs text-[var(--muted)]">
                                Campos: {log.field_name}
                                {log.new_value_text ? ` -> Novo valor: ${log.new_value_text}` : ""}
                              </p>
                            ) : null}

                            {log.change_reason ? (
                              <p className="text-xs italic text-[var(--muted)]">
                                Motivo: {log.change_reason}
                              </p>
                            ) : null}
                          </div>
                        );
                      })
                    ) : (
                      <p className="py-6 text-center text-sm text-[var(--muted)]">
                        Nenhuma alteração registrada no histórico.
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-4 border-t border-[var(--panel-border)] pt-6">
                  <div className="border-b border-[var(--panel-border)] pb-3">
                    <h3 className="text-xl font-semibold text-white">Revisões de conhecimento</h3>
                    <p className="mt-1 text-sm text-[var(--muted)]">
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
                            className="flex flex-col gap-2 rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] p-4"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-semibold uppercase tracking-wider text-white">
                                {review.entity_type}
                              </span>
                              <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase ${statusTone}`}>
                                {review.review_status}
                              </span>
                            </div>
                            <p className="text-xs text-[var(--muted)]">
                              ID da entidade: {review.entity_id.slice(0, 8).toUpperCase()}
                            </p>
                            <div className="mt-1 border-t border-white/5 pt-2">
                              <p className="text-xs leading-relaxed text-[var(--muted)]">
                                Notas: {review.review_notes || "Sem observações registradas."}
                              </p>
                              <p className="mt-2 text-right text-[10px] text-[var(--muted)]">
                                Por {review.users?.full_name ?? "Revisor"} • {dateLabel}
                              </p>
                            </div>
                          </article>
                        );
                      })
                    ) : (
                      <p className="py-6 text-center text-sm text-[var(--muted)] sm:col-span-2">
                        Nenhuma revisão de conhecimento registrada ainda.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ) : null}
          </section>

          <aside className="flex flex-col gap-4 self-start rounded-[30px] border border-[var(--panel-border)] bg-[var(--panel)] p-4 text-white shadow-xl sm:p-6">
            {activeTab === "tecnicos" && profileToEdit ? (
              <div className="flex flex-col gap-4">
                <div>
                  <p className="font-mono text-xs uppercase tracking-[0.24em] text-[var(--accent-copper)]">
                    Edição de perfil
                  </p>
                  <h3 className="mt-1 text-2xl font-semibold tracking-tight text-white">
                    Editar técnico
                  </h3>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    Atualize especialidades e permissões do técnico selecionado.
                  </p>
                </div>

                <form action={updateTechnicianProfileAction} className="flex flex-col gap-4">
                  <input type="hidden" name="profile_id" value={profileToEdit.id} />

                  <label className="grid gap-2 text-sm">
                    <span className="font-medium text-[var(--muted)]">Nome de exibição</span>
                    <input
                      disabled
                      type="text"
                      value={profileToEdit.display_name}
                      className="w-full rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 text-white opacity-60 outline-none"
                    />
                  </label>

                  <label className="grid gap-2 text-sm">
                    <span className="font-medium text-[var(--muted)]">E-mail</span>
                    <input
                      disabled
                      type="text"
                      value={profileToEdit.users?.email ?? ""}
                      className="w-full rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 text-white opacity-60 outline-none"
                    />
                  </label>

                  <label className="grid gap-2 text-sm">
                    <span className="font-medium">Resumo de especialidades</span>
                    <input
                      required
                      type="text"
                      name="specialties_summary"
                      defaultValue={profileToEdit.specialties_summary || ""}
                      placeholder="Ex.: TVs LG/Samsung, reparo SMD, BIOS"
                      autoCorrect="on"
                      spellCheck
                      className="w-full rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 text-white outline-none"
                    />
                  </label>

                  <label className="grid gap-2 text-sm">
                    <span className="font-medium">Notas operacionais</span>
                    <textarea
                      name="notes"
                      rows={3}
                      defaultValue={profileToEdit.notes || ""}
                      placeholder="Observações internas sobre o perfil."
                      autoCorrect="on"
                      spellCheck
                      className="w-full rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 text-white outline-none"
                    />
                  </label>

                  <label className="mt-1 flex cursor-pointer items-center gap-3 text-sm">
                    <input
                      type="checkbox"
                      name="is_reviewer"
                      defaultChecked={profileToEdit.is_reviewer}
                      className="h-4 w-4 rounded border-white/10 bg-white/5 text-[var(--accent-copper)] focus:ring-0"
                    />
                    <span>Ativar como revisor técnico</span>
                  </label>

                  <div className="flex gap-3 pt-2">
                    <button
                      type="submit"
                      className="flex-1 rounded-full bg-[var(--accent-copper)] py-3 text-sm font-semibold text-white shadow-md transition hover:-translate-y-0.5"
                    >
                      Salvar alterações
                    </button>
                    <Link
                      href="/configuracoes?tab=tecnicos"
                      className="rounded-full border border-[var(--panel-border)] px-5 py-3 text-center text-sm font-semibold text-white transition hover:bg-white/5"
                    >
                      Cancelar
                    </Link>
                  </div>

                  <div className="border-t border-white/10 pt-4">
                    <DeleteTechnicianButton profileId={profileToEdit.id} />
                  </div>
                </form>
              </div>
            ) : null}

            {activeTab === "tecnicos" && !profileToEdit ? (
              <>
                <div className="flex flex-col gap-4 rounded-[26px] border border-white/10 bg-white/4 p-4">
                  <div>
                    <p className="font-mono text-xs uppercase tracking-[0.24em] text-[var(--accent-copper)]">
                      Novo acesso interno
                    </p>
                    <h3 className="mt-1 text-2xl font-semibold tracking-tight text-white">
                      Cadastrar técnico sem sair do sistema
                    </h3>
                    <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                      A conta é criada no Supabase Auth e o banco sincroniza automaticamente
                      os registros em <code className="text-white/80">users</code> e{" "}
                      <code className="text-white/80">technician_profiles</code>.
                    </p>
                  </div>

                  <form action={createTechnicianAccessAction} className="grid gap-4">
                    <label className="grid gap-2 text-sm">
                      <span className="font-medium">Nome completo</span>
                      <input
                        required
                        type="text"
                        name="full_name"
                        autoComplete="name"
                        autoCorrect="on"
                        spellCheck
                        className="rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 text-white outline-none"
                      />
                    </label>

                    <label className="grid gap-2 text-sm">
                      <span className="font-medium">E-mail</span>
                      <input
                        required
                        type="email"
                        name="email"
                        autoComplete="email"
                        className="rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 text-white outline-none"
                      />
                    </label>

                    <label className="grid gap-2 text-sm">
                      <span className="font-medium">Senha inicial</span>
                      <input
                        required
                        type="password"
                        name="password"
                        minLength={6}
                        autoComplete="new-password"
                        className="rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 text-white outline-none"
                      />
                    </label>

                    <label className="grid gap-2 text-sm">
                      <span className="font-medium">Especialidades</span>
                      <input
                        type="text"
                        name="specialties_summary"
                        placeholder="Ex.: notebooks, fontes chaveadas, BIOS"
                        autoCorrect="on"
                        spellCheck
                        className="rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 text-white outline-none"
                      />
                    </label>

                    <label className="grid gap-2 text-sm">
                      <span className="font-medium">Notas operacionais</span>
                      <textarea
                        name="notes"
                        rows={3}
                        placeholder="Observações internas sobre este acesso."
                        autoCorrect="on"
                        spellCheck
                        className="rounded-2xl border border-[var(--panel-border)] bg-[var(--background)] px-4 py-3 text-white outline-none"
                      />
                    </label>

                    <label className="flex items-center gap-3 text-sm">
                      <input
                        type="checkbox"
                        name="is_reviewer"
                        className="h-4 w-4 rounded border-white/10 bg-white/5 text-[var(--accent-copper)] focus:ring-0"
                      />
                      <span>Já cadastrar como revisor técnico</span>
                    </label>

                    <button
                      type="submit"
                      className="rounded-full bg-[var(--accent-copper)] px-5 py-3 text-sm font-semibold text-white shadow-md transition hover:-translate-y-0.5"
                    >
                      Criar novo usuário
                    </button>
                  </form>
                </div>

                <div className="grid gap-4">
                  <div className="rounded-2xl border border-white/5 bg-white/3 p-4">
                    <p className="text-[10px] uppercase tracking-wider text-[var(--muted)]">
                      Técnicos cadastrados
                    </p>
                    <p className="mt-1 text-3xl font-semibold text-white">{profiles.length}</p>
                    <p className="mt-1 text-xs text-[var(--muted)]">
                      {profiles.filter((profile) => profile.is_reviewer).length} revisores técnicos autorizados.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-[rgba(184,109,60,0.22)] bg-[rgba(184,109,60,0.06)] p-4 text-xs leading-5 text-[rgba(255,245,236,0.72)]">
                    <strong className="text-white">Fluxo esperado:</strong> após criar o usuário,
                    o técnico deve confirmar o e-mail recebido antes do primeiro login. Se o Supabase
                    responder com limite de envio, aguarde alguns minutos e tente novamente.
                  </div>
                </div>
              </>
            ) : null}

            {activeTab === "auditoria" ? (
              <div className="flex flex-col gap-4">
                <div>
                  <p className="font-mono text-xs uppercase tracking-[0.24em] text-[rgba(255,245,236,0.56)]">
                    Resumo do sistema
                  </p>
                  <h3 className="mt-1 text-2xl font-semibold tracking-tight text-white">
                    Status operacional
                  </h3>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    Indicadores globais de configuração e auditoria.
                  </p>
                </div>

                <div className="grid gap-4">
                  <div className="rounded-2xl border border-white/5 bg-white/3 p-4">
                    <p className="text-[10px] uppercase tracking-wider text-[var(--muted)]">
                      Técnicos cadastrados
                    </p>
                    <p className="mt-1 text-3xl font-semibold text-white">{profiles.length}</p>
                    <p className="mt-1 text-xs text-[var(--muted)]">
                      {profiles.filter((profile) => profile.is_reviewer).length} revisores técnicos autorizados.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-white/5 bg-white/3 p-4">
                    <p className="text-[10px] uppercase tracking-wider text-[var(--muted)]">
                      Log de auditoria
                    </p>
                    <p className="mt-1 text-3xl font-semibold text-[var(--accent-copper)]">
                      {history.length}
                    </p>
                    <p className="mt-1 text-xs text-[var(--muted)]">
                      Modificações salvas na base atual.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-white/5 bg-white/3 p-4">
                    <p className="text-[10px] uppercase tracking-wider text-[var(--muted)]">
                      Revisões de conhecimento
                    </p>
                    <p className="mt-1 text-3xl font-semibold text-[var(--accent-teal)]">
                      {reviews.length}
                    </p>
                    <p className="mt-1 text-xs text-[var(--muted)]">
                      Casos avaliados e promovidos por revisores.
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl border border-[rgba(45,139,130,0.22)] bg-[rgba(45,139,130,0.06)] p-4 text-xs leading-5 text-[rgba(255,245,236,0.72)]">
                  <strong className="text-white">Segurança:</strong> o registro de alterações é
                  imutável e acompanha inserções, edições e exclusões feitas nos dados operacionais
                  e no catálogo técnico.
                </div>
              </div>
            ) : null}
          </aside>
        </div>
      </div>
    </AppShell>
  );
}
