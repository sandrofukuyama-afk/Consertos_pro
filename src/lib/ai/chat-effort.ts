/**
 * Mensagens simples do tecnico ("ok", "feito", "deu 19,5 V no PQ708") vao com
 * esforco baixo: menos raciocinio, resposta mais rapida e mais barata. Na
 * duvida, NAO e simples (fica no esforco normal).
 */

const MAX_SIMPLE_LENGTH = 80;

// Pergunta, pedido de analise/plano, assunto delicado ou sintoma grave: esforco normal.
const COMPLEX_HINTS =
  /\?|\b(por ?qu[eê]|porque|como|qual|quais|onde|explic|analis|compar|plano|pr[oó]xim|ajud|d[uú]vida|encerr|reabr|grav|bios|esquema|boardview|datasheet|pesquis|procur|cliente|or[cç]amento|relat[oó]rio|curto|esquent|queim|fuma|cheiro|estranh|mudou|voltou)/i;

const ACKNOWLEDGEMENT =
  /^(ok|okay|certo|beleza|blz|feito|pronto|sim|n[aã]o|entendi|valeu|obrigad[oa]|perfeito|show|combinado|medi|medido|confirmado|t[aá]|tudo bem)[.!\s]*$/i;

// Numero com unidade eletrica: tensao, corrente, resistencia, frequencia, potencia.
const MEASUREMENT = /\d+(?:[.,]\d+)?\s*(?:mv|v|volts?|ma|amp|amperes?|k?ohms?|k?Ω|mΩ|w|hz|khz|mhz)(?![a-z])/i;

export function isSimpleChatMessage(text: string, attachmentCount: number) {
  const trimmed = text.trim();

  if (!trimmed || attachmentCount > 0 || trimmed.length > MAX_SIMPLE_LENGTH) {
    return false;
  }

  if (COMPLEX_HINTS.test(trimmed)) {
    return false;
  }

  return ACKNOWLEDGEMENT.test(trimmed) || MEASUREMENT.test(trimmed);
}
