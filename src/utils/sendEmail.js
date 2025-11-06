import nodemailer from "nodemailer"


const sendEmail = async ({from = process.env.EMAIL_USER, to, subject, text, html} = {}) => {
	const transporter = nodemailer.createTransport({
        service: "gmail",
		auth: {
			user: process.env.EMAIL_USER || "kirellossamy8@gmail.com",
			pass: process.env.EMAIL_PASSWORD || "fiww dems qjlq uvdc",
		},
	})

    // Log email details for debugging (remove in production)
    console.log("📧 Preparing to send email:", { to, subject });

    try {
        await transporter.sendMail({
            from: "shopverse <noreply@shopverse.com>",
            to,
            subject,
            text,
            html,
        })
        console.log("✅ Email sent successfully to:", to);
    } catch (error) {
        console.error("❌ Error sending email:", error);
        throw error; // Re-throw the error so calling functions can handle it
    }
}

export default sendEmail