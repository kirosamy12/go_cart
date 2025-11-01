import express ,{json} from 'express'
import connection from './DB/connection.js'
import { allRoutes } from './src/index.routes.js'
import cors from "cors"
import session from "express-session"
import passport from "passport"
import dotenv from "dotenv"

// Load environment variables
dotenv.config()

const app = express()
app.use(json())
const PORT = process.env.PORT || 4000;

// Configure session middleware
app.use(session({
  secret: process.env.SESSION_SECRET || 'fallback_secret',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false } // Set to true if using HTTPS
}))

// Initialize Passport middleware
app.use(passport.initialize())
app.use(passport.session())

app.use(cors())
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