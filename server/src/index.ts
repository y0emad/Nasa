import 'dotenv/config'
import Server from './server'
const PORT = process.env.PORT  || 8000;

const {app} = new Server();
app.listen(PORT,()=>console.log(`server run on port ${PORT}`))
