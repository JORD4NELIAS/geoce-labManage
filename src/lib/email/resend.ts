import { Resend } from 'resend';

const resendApiKey = process.env.RESEND_API_KEY;

export const resend = resendApiKey ? new Resend(resendApiKey) : null;

export async function sendWelcomeEmail(to: string, fullName: string) {
  if (!resend) {
    console.warn('[Resend] Chave de API não configurada. E-mail não disparado.');
    return;
  }

  try {
    return await resend.emails.send({
      from: 'GEOCE LabLicence <suporte@geoce.ufc.br>',
      to,
      subject: 'Acesso Liberado — GEOCE LabLicence',
      html: `
        <div style="font-family: sans-serif; color: #1e293b; max-width: 600px; margin: auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px;">
          <h2 style="color: #15803d;">Bem-vindo ao GEOCE LabLicence, ${fullName}!</h2>
          <p>Sua conta Google foi vinculada com sucesso ao nosso sistema de gestão de hardware.</p>
          <p>Você possui uma cota semanal inicial de <strong>20 horas</strong> para agendamento de máquinas e nós de processamento.</p>
          <p style="margin-top: 16px; font-size: 14px; color: #64748b;">
            Lembre-se da regra de <em>Fair Sharing</em>: cada sessão tem duração máxima contínua de 4 horas para permitir o uso compartilhado por todos os pesquisadores.
          </p>
        </div>
      `,
    });
  } catch (err) {
    console.error('[Resend Error - Welcome Email]:', err);
  }
}

export async function sendAdminNewUserAlert(fullName: string, email: string) {
  if (!resend || !process.env.ADMIN_ALERT_EMAIL) {
    console.warn('[Resend] Chave de API ou ADMIN_ALERT_EMAIL não configurados.');
    return;
  }

  try {
    return await resend.emails.send({
      from: 'GEOCE LabLicence <sistema@geoce.ufc.br>',
      to: process.env.ADMIN_ALERT_EMAIL,
      subject: '[NOVO USUÁRIO] Cadastro via Google Detectado',
      html: `
        <div style="font-family: sans-serif; color: #1e293b; max-width: 600px; margin: auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px;">
          <h3 style="color: #0369a1;">Novo Cadastro de Pesquisador/Aluno</h3>
          <p><strong>Nome:</strong> ${fullName}</p>
          <p><strong>E-mail:</strong> ${email}</p>
          <p><strong>Data/Hora:</strong> ${new Date().toISOString()}</p>
        </div>
      `,
    });
  } catch (err) {
    console.error('[Resend Error - Admin Alert]:', err);
  }
}
