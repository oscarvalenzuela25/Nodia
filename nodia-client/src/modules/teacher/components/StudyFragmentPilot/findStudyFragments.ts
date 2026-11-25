type Topic = { id: string; title: string; body_markdown: string };

export function findStudyFragments(blocks: readonly Topic[]) {
  const vowels = blocks.filter(({ title, body_markdown: body }) =>
    title === "Letras, sonidos y palabras" &&
    /\bsit\b/.test(body) && /\bseat\b/.test(body) &&
    body.includes("/sɪt/") && /\/si[ː:]t\//.test(body));
  const spelling = blocks.filter(({ title, body_markdown: body }) =>
    title === "Deletrear sin omitir caracteres" && /\bBEE[-–]22\b/.test(body));

  if (vowels.length !== 1 || spelling.length !== 1 || vowels[0].id === spelling[0].id) return null;
  return { vowels: vowels[0].id, spelling: spelling[0].id };
}
