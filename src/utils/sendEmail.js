import nodemailer from "nodemailer"

const sendEmail = async ({from = process.env.EMAIL_USER, to, subject, text, html} = {}) => {
    // Check if email configuration exists
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
        console.error("❌ Email configuration missing. Please set EMAIL_USER and EMAIL_PASSWORD in .env file");
        throw new Error("Email configuration missing");
    }

    const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASSWORD,
        },
    })

    // Log email details for debugging (remove in production)
    console.log("📧 Preparing to send email:", { from, to, subject });

    try {
        await transporter.sendMail({
            from: from || `"Shopverse" <${process.env.EMAIL_USER}>`,
            to,
            subject: `[Shopverse] ${subject}`,
            text,
            html,
        })
        console.log("✅ Email sent successfully to:", to);
        return { success: true };
    } catch (error) {
        console.error("❌ Error sending email:", error);
        console.error("❌ Email config details:", {
            EMAIL_USER: process.env.EMAIL_USER ? `${process.env.EMAIL_USER.substring(0, 5)}...` : 'NOT SET',
            EMAIL_PASSWORD: process.env.EMAIL_PASSWORD ? 'SET' : 'NOT SET'
        });
        throw error; // Re-throw the error so calling functions can handle it
    }
}

export default sendEmail