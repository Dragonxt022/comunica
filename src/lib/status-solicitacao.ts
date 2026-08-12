export const STATUS_SOLICITACAO = [
  {
    key: 'pendente', label: 'Pendente', chipLabel: 'Pendente',
    badge: 'bg-yellow-100 text-yellow-800',
    chip: 'border-yellow-400 text-yellow-700 hover:bg-yellow-50',
    hd: 'bg-yellow-50 border-yellow-200 text-yellow-800', dot: 'bg-yellow-400',
    icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
  },
  {
    key: 'aprovado', label: 'Aprovado', chipLabel: 'Aprovado',
    badge: 'bg-blue-100 text-blue-800',
    chip: 'border-blue-400 text-blue-700 hover:bg-blue-50',
    hd: 'bg-blue-50 border-blue-200 text-blue-800', dot: 'bg-blue-500',
    icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
  },
  {
    key: 'produção', label: 'Produção', chipLabel: 'Em Produção',
    badge: 'bg-indigo-100 text-indigo-800',
    chip: 'border-indigo-400 text-indigo-700 hover:bg-indigo-50',
    hd: 'bg-indigo-50 border-indigo-200 text-indigo-800', dot: 'bg-indigo-500',
    icon: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15',
  },
  {
    key: 'concluído', label: 'Concluído', chipLabel: 'Concluído',
    badge: 'bg-teal-100 text-teal-800',
    chip: 'border-teal-400 text-teal-700 hover:bg-teal-50',
    hd: 'bg-teal-50 border-teal-200 text-teal-800', dot: 'bg-teal-500',
    icon: 'M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4',
  },
  {
    key: 'finalizado', label: 'Finalizado', chipLabel: 'Finalizado',
    badge: 'bg-green-100 text-green-800',
    chip: 'border-green-400 text-green-700 hover:bg-green-50',
    hd: 'bg-green-50 border-green-200 text-green-800', dot: 'bg-green-500',
    icon: 'M5 13l4 4L19 7',
  },
  {
    key: 'cancelado', label: 'Cancelado', chipLabel: 'Cancelado',
    badge: 'bg-red-100 text-red-700',
    chip: 'border-red-300 text-red-600 hover:bg-red-50',
    hd: 'bg-red-50 border-red-200 text-red-800', dot: 'bg-red-400',
    icon: 'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z',
  },
];

export const STATUS_SOLICITACAO_MAP = Object.fromEntries(
  STATUS_SOLICITACAO.map((s) => [s.key, s])
);
