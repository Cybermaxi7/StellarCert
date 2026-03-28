import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as Handlebars from 'handlebars';

@Injectable()
export class EmailService {
  private templates = new Map<string, Handlebars.TemplateDelegate>();

  constructor() {
    this.loadTemplates();
  }

  private loadTemplates() {
    const templatesDir = path.join(__dirname, 'templates');

    const templateFiles = [
      'certificate-issued.hbs',
      'verification-email.hbs',
      'password-reset.hbs',
      'revocation-notice.hbs',
    ];

    for (const file of templateFiles) {
      const filePath = path.join(templatesDir, file);

      if (!fs.existsSync(filePath)) {
        throw new Error(`Missing email template: ${file}`);
      }

      const source = fs.readFileSync(filePath, 'utf-8');
      const compiled = Handlebars.compile(source);

      this.templates.set(file, compiled);
    }
  }

  render(templateName: string, data: any): string {
    const template = this.templates.get(templateName);

    if (!template) {
      throw new Error(`Template not found: ${templateName}`);
    }

    return template(data);
  }
}
