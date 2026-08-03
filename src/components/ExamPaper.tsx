import { forwardRef, useState } from "react";
import { ExamData, HeaderInfo, Questao } from "../types";
import { buildExamTitle } from "../lib/examTitle";
import {
  ExamPaperMode,
  LABELS,
  hasMultiplaEscolha,
  formatQuestionNumber,
  isCorrectAlternative,
  normalizeImageSource,
  shouldShowResolucao,
} from "../lib/examContent";
import { resolveLogoSrc, SchoolId, SchoolInfo } from "../lib/schoolInfo";
import { MathText } from "./MathText";

export type { ExamPaperMode };

interface ExamPaperProps {
  exam: ExamData;
  header: HeaderInfo;
  schools: Record<SchoolId, SchoolInfo>;
  mode?: ExamPaperMode;
}

function LogoImage({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div className="flex h-16 w-16 items-center justify-center rounded-full border border-dashed border-zinc-400 text-center text-[9px] leading-tight text-zinc-500">
        {alt}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className="h-16 w-16 object-contain"
      onError={() => setFailed(true)}
    />
  );
}

const CIRCLED_LETTERS: Record<string, string> = {
  A: "Ⓐ",
  B: "Ⓑ",
  C: "Ⓒ",
  D: "Ⓓ",
};

function LetraBolha({
  letra,
  preenchida,
}: {
  letra: string;
  preenchida: boolean;
}) {
  if (preenchida) {
    return (
      <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-zinc-900 align-middle text-[9px] font-bold leading-none text-white">
        {letra}
      </span>
    );
  }
  return <span>{CIRCLED_LETTERS[letra] ?? letra}</span>;
}

function GabaritoBox({
  questoes,
  mode,
}: {
  questoes: Questao[];
  mode: ExamPaperMode;
}) {
  return (
    <table className="float-right mb-2 ml-4 border-collapse border border-zinc-400 text-xs">
      <thead>
        <tr>
          <th
            colSpan={2}
            className="border border-zinc-400 bg-zinc-200 px-2 py-1 font-bold"
          >
            {LABELS.gabarito}
          </th>
        </tr>
      </thead>
      <tbody>
        {questoes.map((questao) => (
          <tr key={questao.numero}>
            <td className="border border-zinc-400 px-2 py-1 text-center">
              {formatQuestionNumber(questao.numero)}
            </td>
            <td className="border border-zinc-400 px-2 py-1 text-center text-sm tracking-widest">
              {questao.tipo === "multipla_escolha" ? (
                <span className="inline-flex gap-1">
                  {questao.alternativas.map((alt) => {
                    const letra = alt.letra.toUpperCase();
                    return (
                      <LetraBolha
                        key={letra}
                        letra={letra}
                        preenchida={
                          mode === "gabarito" &&
                          isCorrectAlternative(questao, letra)
                        }
                      />
                    );
                  })}
                </span>
              ) : (
                <span className="italic">{LABELS.dissertativa}</span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export const ExamPaper = forwardRef<HTMLDivElement, ExamPaperProps>(
  function ExamPaper({ exam, header, schools, mode = "prova" }, ref) {
    const escola = schools[header.escola] ?? Object.values(schools)[0];
    return (
      <div ref={ref} className="bg-white p-8 text-zinc-900">
        <div className="relative mb-3 min-h-16">
          {escola.logoEsquerda && (
            <div className="absolute left-0 top-0">
              <LogoImage
                src={resolveLogoSrc(escola.logoEsquerda)}
                alt={`Logo ${escola.nome}`}
              />
            </div>
          )}
          {escola.logoDireita && (
            <div className="absolute right-0 top-0">
              <LogoImage
                src={resolveLogoSrc(escola.logoDireita)}
                alt={`Logo ${escola.nome}`}
              />
            </div>
          )}
          <div className="mx-auto max-w-[calc(100%-9rem)] text-center text-[0.625rem]">
            <p className="text-sm font-bold">{escola.instituicao}</p>
            <p>{escola.endereco}</p>
            <p>
              {LABELS.telefonePrefix} {escola.telefone} &nbsp;&nbsp; {LABELS.emailPrefix} {escola.email}
            </p>
          </div>
        </div>

        <div className="mb-2 flex justify-between text-xs">
          <span>
            <span className="font-semibold">{LABELS.alunoPrefix}</span>{" "}
            <span className="inline-block w-72 border-b border-zinc-400">
              &nbsp;
            </span>
          </span>
          <span>
            <span className="font-semibold">{LABELS.numeroPrefix}</span>{" "}
            <span className="inline-block w-16 border-b border-zinc-400">
              &nbsp;
            </span>
          </span>
        </div>

        <div className="mb-4 flex flex-wrap justify-between gap-2 text-xs">
          <span>
            <span className="font-semibold">{LABELS.professorPrefix}</span>{" "}
            {header.professor || "—"}
          </span>
          <span>
            <span className="font-semibold">{LABELS.dataPrefix}</span> {LABELS.dataPlaceholder}
          </span>
          <span>
            <span className="font-semibold">{LABELS.turmaPrefix}</span> {header.turma || "—"}
          </span>
          <span>
            <span className="font-semibold">{LABELS.notaPrefix}</span>{" "}
            <span className="inline-block w-16 border-b border-zinc-400">
              &nbsp;
            </span>
          </span>
        </div>

        <p className="mb-3 text-sm font-bold">{buildExamTitle(header)}</p>

        <div>
          {hasMultiplaEscolha(exam.questoes) && (
            <GabaritoBox questoes={exam.questoes} mode={mode} />
          )}
          <ol className="list-none space-y-6 text-xs">
            {exam.questoes.map((questao) => (
              <li key={questao.numero}>
                <p className="mb-2">
                  <span className="font-semibold">{questao.numero}.</span>{" "}
                  <MathText text={questao.enunciado} />
                </p>
                {questao.imagem ? (
                  <div className="mb-2 flex justify-center">
                    <img
                      src={normalizeImageSource(questao.imagem)}
                      alt={`Imagem da questão ${questao.numero}`}
                      className="max-h-56 max-w-full rounded-md border border-zinc-300 bg-white object-contain"
                    />
                  </div>
                ) : null}
                {questao.tipo === "multipla_escolha" ? (
                  <ul className="ml-4 space-y-1">
                    {questao.alternativas.map((alt) => (
                      <li key={alt.letra}>
                        {alt.letra.toUpperCase()}) <MathText text={alt.texto} />
                      </li>
                    ))}
                  </ul>
                ) : mode === "prova" ? (
                  <div className="ml-1 mt-2 space-y-3 overflow-hidden">
                    {[0, 1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className="border-b border-dotted border-zinc-400"
                      />
                    ))}
                  </div>
                ) : null}
                {shouldShowResolucao(mode) && (
                  <p className="ml-1 mt-2 text-red-600">
                    <span className="font-semibold">{LABELS.resolucaoPrefix}</span>{" "}
                    {questao.resolucao ? (
                      <MathText text={questao.resolucao} />
                    ) : null}
                  </p>
                )}
              </li>
            ))}
          </ol>
        </div>
      </div>
    );
  },
);
