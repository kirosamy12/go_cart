import express ,{json} from 'express'
import connection from './DB/connection.js'
import { allRoutes } from './src/index.routes.js'



import cors from "cors"

const app = express()
app.use(json())
const PORT = 4000;
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
  
 