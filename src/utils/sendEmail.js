import nodemailer from "nodemailer"


const sendEmail = async ({from = process.env.EMAIL_USER, to,subject,text,html} = {}) => {
	const transporter = nodemailer.createTransport({
        service:"gmail",
		auth: {
			user: "kirellossamy8@gmail.com",
			pass: "rwwr aiyn iamq ufvy" ,
		},
	})

    await transporter.sendMail({
        from:`"code"<${from}>`,
        to,
        subject,
        text,
        html,
    })
    console.log("email sent")
}

export default sendEmail
