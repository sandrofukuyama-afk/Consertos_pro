const AUTH_ERROR_MAP: Array<[RegExp, string]> = [
  [/email rate limit exceeded/i, "O Supabase bloqueou temporariamente novos envios de e-mail. Aguarde alguns minutos e tente novamente."],
  [/email not confirmed/i, "Seu e-mail ainda não foi confirmado. Abra a caixa de entrada e confirme o acesso antes de entrar."],
  [/invalid login credentials/i, "E-mail ou senha inválidos."],
  [/email address .* is invalid/i, "Informe um e-mail válido para continuar."],
  [/user already registered/i, "Já existe uma conta cadastrada com este e-mail."],
  [/signup is disabled/i, "O cadastro de novos usuários está desativado no Supabase."],
  [/password should be at least/i, "A senha precisa ter pelo menos 6 caracteres."],
];

export function mapSupabaseAuthErrorMessage(message: string) {
  const normalizedMessage = message.trim();

  for (const [pattern, friendlyMessage] of AUTH_ERROR_MAP) {
    if (pattern.test(normalizedMessage)) {
      return friendlyMessage;
    }
  }

  return normalizedMessage || "Ocorreu um erro de autenticação no Supabase.";
}
