import assert from "node:assert/strict";
import test from "node:test";

import { isSimpleChatMessage } from "./chat-effort.ts";

test("mensagens simples vao com esforco baixo", () => {
  for (const text of ["ok", "Feito.", "pronto", "sim", "não", "deu 19,5 V no PQ708", "PP3V3 = 3.31v", "C4706 1.2 kohm", "0V no TP-672"]) {
    assert.equal(isSimpleChatMessage(text, 0), true, text);
  }
});

test("pergunta, analise, sintoma grave, foto ou texto longo ficam no esforco normal", () => {
  for (const text of [
    "deu 19V, e agora?",
    "por que o PU4 não liga",
    "qual o próximo passo",
    "deu 0,2 ohm, curto no rail",
    "o mosfet esquentou com 5V",
    "pode gravar a bios",
    "troquei o capacitor",
    "",
    "deu 19,5 V no PQ708 e 3,3 V no PU1001 mas o 5V_S5 ficou em 0 e a placa desliga depois de uns segundos",
  ]) {
    assert.equal(isSimpleChatMessage(text, 0), false, text);
  }
  assert.equal(isSimpleChatMessage("ok", 1), false, "com foto");
});
