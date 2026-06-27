import { Request, Response } from 'express';
import { Evento, FormularioTemplate, Secretaria } from '../../database/models/index.ts';
import InscricaoRepository from '../inscricoes/repository.ts';

async function getEventoByToken(token: string) {
  return Evento.findOne({
    where: { token_inscricao: token, aceita_inscricoes: true, arquivado: false },
    include: [{ model: Secretaria, as: 'secretaria' }],
  }) as any;
}

export const formView = async (req: Request, res: Response) => {
  try {
    const evento = await getEventoByToken(req.params.token);
    if (!evento) {
      return res.render('public/inscricao-indisponivel', {
        title: 'Inscrição Indisponível',
        layout: 'layouts/public',
        motivo: 'Link de inscrição inválido ou evento não disponível.',
      });
    }

    if (!evento.inscricoes_abertas) {
      return res.render('public/inscricao-indisponivel', {
        title: 'Inscrições Encerradas',
        layout: 'layouts/public',
        motivo: 'As inscrições para este evento estão encerradas.',
      });
    }

    const total = await InscricaoRepository.countByEvento(evento.id);
    if (evento.max_inscricoes !== null && total >= evento.max_inscricoes) {
      return res.render('public/inscricao-indisponivel', {
        title: 'Vagas Esgotadas',
        layout: 'layouts/public',
        motivo: `As vagas para "${evento.titulo}" estão esgotadas.`,
      });
    }

    let campos: any[] = [];
    if (evento.formulario_template_id) {
      const tpl = await FormularioTemplate.findOne({ where: { id: evento.formulario_template_id } }) as any;
      if (tpl) try { campos = JSON.parse(tpl.campos || '[]'); } catch { campos = []; }
    }

    res.render('public/inscricao-form', {
      title: `Inscrição — ${evento.titulo}`,
      layout: 'layouts/public',
      evento,
      campos,
      erro: null,
      vagas: evento.max_inscricoes ? evento.max_inscricoes - total : null,
    });
  } catch (error) {
    console.error('Error public form view:', error);
    res.status(500).send('Internal Server Error');
  }
};

export const submit = async (req: Request, res: Response) => {
  try {
    const evento = await getEventoByToken(req.params.token);
    if (!evento || !evento.inscricoes_abertas) {
      return res.redirect(`/inscricao/${req.params.token}`);
    }

    const total = await InscricaoRepository.countByEvento(evento.id);
    if (evento.max_inscricoes !== null && total >= evento.max_inscricoes) {
      return res.redirect(`/inscricao/${req.params.token}`);
    }

    const { nome, email, telefone, ...extras } = req.body;

    let campos: any[] = [];
    if (evento.formulario_template_id) {
      const tpl = await FormularioTemplate.findOne({ where: { id: evento.formulario_template_id } }) as any;
      if (tpl) try { campos = JSON.parse(tpl.campos || '[]'); } catch { campos = []; }
    }

    const renderErro = (erro: string) => res.render('public/inscricao-form', {
      title: `Inscrição — ${evento.titulo}`,
      layout: 'layouts/public',
      evento,
      campos,
      erro,
      vagas: evento.max_inscricoes ? evento.max_inscricoes - total : null,
    });

    if (!nome || !email) return renderErro('Nome e e-mail são obrigatórios.');

    const emailNorm = String(email).trim().toLowerCase();
    const jaInscrito = await InscricaoRepository.findByEmailAndEvento(emailNorm, evento.id);
    if (jaInscrito) {
      return renderErro(`O e-mail ${emailNorm} já possui uma inscrição ativa para este evento (${jaInscrito.numero_inscricao}).`);
    }

    const numero = await InscricaoRepository.generateNumero(evento.id);

    // coleta respostas dos campos extras do formulário
    const dados: Record<string, any> = {};
    if (evento.formulario_template_id) {
      const tpl = await FormularioTemplate.findOne({ where: { id: evento.formulario_template_id } }) as any;
      if (tpl) {
        let campos: any[] = [];
        try { campos = JSON.parse(tpl.campos || '[]'); } catch { campos = []; }
        for (const campo of campos) {
          const val = req.body[`campo_${campo.id}`];
          dados[campo.id] = Array.isArray(val) ? val : (val || '');
        }
      }
    }

    const inscricao = await InscricaoRepository.create({
      evento_id: evento.id,
      numero_inscricao: numero,
      nome: String(nome).trim(),
      email: emailNorm,
      telefone: telefone ? String(telefone).trim() : '',
      dados: JSON.stringify(dados),
      status: 'confirmado',
      ip: req.ip || '',
    }) as any;

    res.redirect(`/inscricao/${req.params.token}/comprovante/${inscricao.id}`);
  } catch (error) {
    console.error('Error submitting inscricao:', error);
    res.status(500).send('Internal Server Error');
  }
};

export const comprovante = async (req: Request, res: Response) => {
  try {
    const inscricao = await InscricaoRepository.findById(Number(req.params.id)) as any;
    if (!inscricao) return res.status(404).send('Inscrição não encontrada');

    const evento = inscricao.evento as any;
    if (evento?.token_inscricao !== req.params.token) return res.status(403).send('Acesso negado');

    let campos: any[] = [];
    let dados: Record<string, any> = {};
    try { dados = JSON.parse(inscricao.dados || '{}'); } catch { dados = {}; }

    if (evento.formulario_template_id) {
      const tpl = await FormularioTemplate.findOne({ where: { id: evento.formulario_template_id } }) as any;
      if (tpl) try { campos = JSON.parse(tpl.campos || '[]'); } catch { campos = []; }
    }

    res.render('public/inscricao-comprovante', {
      title: `Comprovante — ${inscricao.numero_inscricao}`,
      layout: 'layouts/print',
      inscricao,
      evento,
      campos,
      dados,
    });
  } catch (error) {
    console.error('Error comprovante:', error);
    res.status(500).send('Internal Server Error');
  }
};
