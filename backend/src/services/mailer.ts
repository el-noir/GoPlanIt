import nodemailer from 'nodemailer';

export const sendMail = async (
  to: string,
  subject: string,
  text: string
): Promise<void> => {
  try {
    const transporter = nodemailer.createTransport({
      host: process.env.MAILTRAP_SMTP_HOST as string,
      port: Number(process.env.MAILTRAP_SMTP_PORT) || 587,
      secure: false,
      auth: {
        user: process.env.MAILTRAP_SMTP_USER as string,
        pass: process.env.MAILTRAP_SMTP_PASS as string,
      },
    })

    const info = await transporter.sendMail({
      from: 'GoPlanIt',
      to,
      subject,
      text,
    })

    console.log('Mail sent: ', info.messageId)
  } catch (error) {
    const err = error as Error
    console.log('Error while sending mail: ', err.message)
    throw err
  }
}