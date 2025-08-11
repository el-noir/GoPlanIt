import nodemailer, { type Transporter, type SendMailOptions } from "nodemailer"

export interface MailConfig {
  host: string
  port: number
  secure: boolean
  auth: {
    user: string
    pass: string
  }
}

export interface EmailOptions {
  to: string
  subject: string
  text: string
  from?: string
}

export const sendMail = async (to: string, subject: string, text: string): Promise<void> => {
  try {
    const config: MailConfig = {
      host: process.env.MAILTRAP_SMTP_HOST as string,
      port: Number(process.env.MAILTRAP_SMTP_PORT) || 587,
      secure: false,
      auth: {
        user: process.env.MAILTRAP_SMTP_USER as string,
        pass: process.env.MAILTRAP_SMTP_PASS as string,
      },
    }

    const transporter: Transporter = nodemailer.createTransport(config)

    const mailOptions: SendMailOptions = {
      from: "GoPlanIt",
      to,
      subject,
      text,
    }

    const info = await transporter.sendMail(mailOptions)

    console.log("Mail sent: ", info.messageId)
  } catch (error) {
    console.log("Error while sending mail: ", (error as Error).message)
    throw error
  }
}
