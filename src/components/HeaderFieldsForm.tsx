import { useState } from 'react';
import { Plus } from 'lucide-react';
import { HeaderInfo } from '../types';
import { createSchoolId, SchoolId, SchoolInfo } from '../lib/schoolInfo';
import { AddSchoolModal } from './AddSchoolModal';

interface HeaderFieldsFormProps {
  value: HeaderInfo;
  onChange: (value: HeaderInfo) => void;
  schools: Record<SchoolId, SchoolInfo>;
  onAddSchool: (id: SchoolId, school: SchoolInfo) => void;
}

export function HeaderFieldsForm({ value, onChange, schools, onAddSchool }: HeaderFieldsFormProps) {
  const [addingSchool, setAddingSchool] = useState(false);

  function handleAddSchool(school: SchoolInfo) {
    const id = createSchoolId(school.nome, Object.keys(schools));
    onAddSchool(id, school);
    onChange({ ...value, escola: id });
    setAddingSchool(false);
  }

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
      <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-zinc-300">Dados do Cabeçalho</h2>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 min-w-0">
          <label htmlFor="escola" className="mb-1.5 block text-xs text-zinc-400">
            Escola
          </label>
          <div className="flex items-center gap-1.5">
            <select
              id="escola"
              value={value.escola}
              onChange={(e) => onChange({ ...value, escola: e.target.value as SchoolId })}
              className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-zinc-600 focus:outline-none"
            >
              {Object.entries(schools).map(([id, school]) => (
                <option key={id} value={id}>
                  {school.nome}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setAddingSchool(true)}
              aria-label="Adicionar nova escola"
              title="Adicionar nova escola"
              className="shrink-0 rounded-lg border border-zinc-800 p-2 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
            >
              <Plus size={16} />
            </button>
          </div>
        </div>

        <div className="min-w-0">
          <label htmlFor="professor" className="mb-1.5 block text-xs text-zinc-400">
            Professor(a)
          </label>
          <input
            id="professor"
            type="text"
            value={value.professor}
            onChange={(e) => onChange({ ...value, professor: e.target.value })}
            placeholder="Ex: Ana Souza"
            className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-600 focus:outline-none"
          />
        </div>

        <div className="min-w-0">
          <label htmlFor="turma" className="mb-1.5 block text-xs text-zinc-400">
            Turma
          </label>
          <input
            id="turma"
            type="text"
            value={value.turma}
            onChange={(e) => onChange({ ...value, turma: e.target.value })}
            placeholder="Ex: 7A"
            className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-600 focus:outline-none"
          />
        </div>

        <div className="min-w-0">
          <label htmlFor="tipo" className="mb-1.5 block text-xs text-zinc-400">
            Tipo
          </label>
          <select
            id="tipo"
            value={value.tipo}
            onChange={(e) => onChange({ ...value, tipo: e.target.value as HeaderInfo['tipo'] })}
            className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-zinc-600 focus:outline-none"
          >
            <option value="avaliacao">Avaliação</option>
            <option value="recuperacao">Recuperação</option>
          </select>
        </div>

        <div className="min-w-0">
          <label htmlFor="valor" className="mb-1.5 block text-xs text-zinc-400">
            Valor
          </label>
          <input
            id="valor"
            type="text"
            value={value.valor}
            onChange={(e) => onChange({ ...value, valor: e.target.value })}
            placeholder="Ex: 3,0"
            className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-600 focus:outline-none"
          />
        </div>
      </div>

      {addingSchool && (
        <AddSchoolModal onAdd={handleAddSchool} onClose={() => setAddingSchool(false)} />
      )}
    </section>
  );
}
