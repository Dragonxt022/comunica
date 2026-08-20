// Textos-padrão do "Relatório Mensal" (modelo Cujubim) — usados apenas para pré-preencher
// o formulário em /relatorios/mensal/novo. O usuário edita livremente antes de gerar;
// o que for de fato submetido é o que aparece no relatório impresso.

export function objetoContratoPadrao(municipioNome: string, uf: string): string {
  return `Prestação de serviços de produção de conteúdo digital para redes sociais e site oficial do Município de ${municipioNome}${uf ? ' - ' + uf : ''}.`;
}

export const OBJETIVO_SERVICO_PADRAO =
  'Informar a população sobre atos, serviços e realizações da administração municipal e ampliar a divulgação do município para públicos externos. Todos serviços entregues observam os princípios de impessoalidade, publicidade e transparência na administração pública.';

export const ARQUIVOS_NUVEM_PADRAO =
  'Manutenção de um espaço dedicado no Google Drive para centralizar todos os materiais. Equipes da Prefeitura e a contratada podem enviar fotos, vídeos, artes e documentos, mantendo a organização por pastas, temas e datas. O acesso é liberado por e-mails autorizados, com permissões de visualização e edição que garantem controle e segurança.';

export const RESULTADOS_EVIDENCIAS_PADRAO =
  'Engajamento orgânico elevado em torno das publicações.\nPadronização visual mantida e ampliada, fortalecendo reconhecimento da instituição.';

export const PROXIMAS_ETAPAS_PADRAO =
  'Seguir em planejamento com as pastas para atender a demanda, principalmente de eventos e ações que possam ser divulgadas com antecedência para que a informação chegue corretamente até a população.';
