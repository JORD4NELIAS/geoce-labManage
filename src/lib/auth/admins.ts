/**
 * Validação de Administradores Pré-Autorizados
 * GEOCE LabManage — Regras de Segurança e Governança
 */

export function getAuthorizedAdminEmails(): string[] {
  const emails: string[] = [];

  // 1. Lista separada por vírgula em ADMIN_EMAILS
  if (process.env.ADMIN_EMAILS) {
    const list = process.env.ADMIN_EMAILS.split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
    emails.push(...list);
  }

  // 2. E-mail configurado em ADMIN_ALERT_EMAIL
  if (process.env.ADMIN_ALERT_EMAIL) {
    const alertEmail = process.env.ADMIN_ALERT_EMAIL.trim().toLowerCase();
    if (alertEmail && !emails.includes(alertEmail)) {
      emails.push(alertEmail);
    }
  }

  return emails;
}

export function isPreAuthorizedAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  const authorized = getAuthorizedAdminEmails();
  return authorized.includes(email.trim().toLowerCase());
}
