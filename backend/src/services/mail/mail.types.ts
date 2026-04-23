export interface SendMailOptions {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
}

export interface SendMailResult {
  messageId: string;
  accepted: string[];
  rejected: string[];
}
