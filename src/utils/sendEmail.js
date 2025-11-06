import nodemailer from "nodemailer"


const sendEmail = async ({from = process.env.EMAIL_USER, to,subject,text,html} = {}) => {
	const transporter = nodemailer.createTransport({
        service:"gmail",
		auth: {
			user: process.env.EMAIL_USER || "kirellossamy8@gmail.com",
			pass: process.env.EMAIL_PASSWORD || "fiww dems qjlq uvdc",
		},
	})

    await transporter.sendMail({
        from:"shopverse <noreply@shopverse.com>",
        to,
        subject,
        text,
        html,
    })
    console.log("email sent")
}

export default sendEmail