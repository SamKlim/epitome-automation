import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import * as fs from 'fs';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter;

  constructor() {
    this.initializeTransporter();
  }

  private initializeTransporter(): void {
    const user = process.env.GMAIL_USER;
    const pass = process.env.GMAIL_APP_PASSWORD;

    console.log(`[EmailService] Initializing Gmail transport with user: ${user ? '✅ SET' : '❌ MISSING'}`);
    console.log(`[EmailService] App password: ${pass ? '✅ SET (length: ' + pass.length + ')' : '❌ MISSING'}`);

    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user,
        pass,
      },
    });
  }

  async sendReport(
    email: string,
    firstName: string,
    lastName: string,
    pdfPath: string,
  ): Promise<{ success: boolean; time: number; messageId?: string }> {
    const startTime = Date.now();

    try {
      // DEBUG: Check credentials before use
      console.log('🔍 DEBUG: Checking Gmail credentials...');
      console.log('  GMAIL_USER:', process.env.GMAIL_USER ? '✅ SET' : '❌ MISSING');
      console.log('  GMAIL_APP_PASSWORD:', process.env.GMAIL_APP_PASSWORD ? '✅ SET (length: ' + process.env.GMAIL_APP_PASSWORD.length + ')' : '❌ MISSING');
      debugger;

      if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
        throw new Error('Gmail credentials not configured in environment variables');
      }

      if (!fs.existsSync(pdfPath)) {
        throw new Error(`PDF file not found at: ${pdfPath}`);
      }

      // Email body template (from Merle's instructions) - HTML format with clickable links
      const emailBody = `<p>Dear ${firstName}</p>

<p>Thank you for completing your Epitome Archetype Assessment. Your personalised report on the four archetypes is attached.</p>

<p>Before you read it, one suggestion. Look first at where the four archetypes sit relative to each other rather than at which one came out highest, and notice whether anything surprises you.</p>

<p>Remember that all four live in you. The report is showing you which ones you are currently drawing on, not which ones you have.</p>

<p>If you would like to take it further, there are two ways to do that.</p>

<p>A single session. Sixty minutes on your report in the context of your actual role - the archetype you lead from, the one you have set down, and what it would take to bring her forward. You leave with something specific to work on.</p>

<p>Three sessions over three months. For women working on something particular: a new role, a step up, a leadership identity that no longer fits. We shape it around what you are facing, and the archetypes become a working language rather than an insight.</p>

<p>For pricing and availability, just reply to this email.</p>

<p>Kind regards<br/>
Merle</p>

<hr/>

<p>
HM Singer<br/>
<a href="mailto:merle@cotw.com.au">merle@cotw.com.au</a><br/>
<a href="mailto:merle@epitome-leadership.com">merle@epitome-leadership.com</a><br/>
<a href="https://instagram.com/epitomeleadership" target="_blank">@epitomeleadership</a><br/>
<a href="https://linkedin.com/in/mesinger" target="_blank">linkedin.com/in/mesinger</a>
</p>`;

      const mailOptions = {
        from: process.env.GMAIL_USER,
        to: email,
        subject: 'Your Epitome Archetype Assessment Report',
        html: emailBody,
        attachments: [
          {
            filename: `epitome-report-${firstName}-${lastName}.pdf`,
            path: pdfPath,
          },
        ],
      };

      const info = await this.transporter.sendMail(mailOptions);
      const duration = Date.now() - startTime;

      this.logger.log(
        `Email sent to ${email} in ${duration}ms. MessageId: ${info.messageId}`,
      );

      return {
        success: true,
        time: duration,
        messageId: info.messageId,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Failed to send email to ${email} after ${duration}ms: ${errorMessage}`,
      );
      throw error;
    }
  }
}
