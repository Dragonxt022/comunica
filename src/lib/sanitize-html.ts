import sanitizeHtml from 'sanitize-html';

const options: sanitizeHtml.IOptions = {
  allowedTags: ['p', 'br', 'strong', 'em', 'u', 's', 'h2', 'h3', 'ul', 'ol', 'li', 'a', 'span'],
  allowedAttributes: {
    a: ['href', 'target', 'rel'],
    span: ['class'],
    p: ['class'],
  },
  allowedClasses: {
    span: ['ql-align-center', 'ql-align-right', 'ql-align-justify'],
    p: ['ql-align-center', 'ql-align-right', 'ql-align-justify'],
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  transformTags: {
    a: sanitizeHtml.simpleTransform('a', { target: '_blank', rel: 'noopener noreferrer' }),
  },
};

export function sanitizeDescricao(html: string): string {
  return sanitizeHtml(html || '', options);
}
