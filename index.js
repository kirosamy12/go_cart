import express ,{json} from 'express'
import connection from './DB/connection.js'
import { allRoutes } from './src/index.routes.js'
import session from "express-session"  // ✅ تأكد من هذا السطر

import passport from "./src/modules/Auth/googleAuth.js" // أنشئ هذا الملف



import cors from "cors"

const app = express()
app.use(json())
const PORT = 4000;
app.use(cors())
app.use(session({
  secret: process.env.SESSION_SECRET || "kiro-secret-key-change-in-production",
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}))
app.use(passport.initialize())
app.use(passport.session())

connection()

app.get('/', (req, res) => {
    res.send('Welcome to my Node.js ????!');
  });
  
  allRoutes(app)

// app.use('*', (req, res) => {
//     res.status(404).send('Route not found!');
//   });

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
  
 