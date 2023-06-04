import express, {Express} from "express";
import general from "./routes/general";
import airports from "./routes/airports";
import routes from "./routes/routes";

const swaggerUi = require('swagger-ui-express')
const swaggerJSON = require('./swagger_output.json')
const app: Express = express();
const port = 3000;

let lang: string = 'ru'

export function getLang (): string{
    return lang
}

export default () => {
    app.use('/doc', swaggerUi.serve, swaggerUi.setup(swaggerJSON))

    app.use((req, res, next) => {
        let date = new Date().toUTCString()
        let langHead = req.header('Accept-Language')

        console.log('---')
        console.log('Time:', date)

        if(langHead){
            // :::^))) ternary hell fan here
            lang = langHead.includes(';') ?
                langHead.split(';')[0].split(',')[1] :
                langHead.includes('-') ?
                    langHead.split('-')[0] :
                    langHead
        } else
            lang = 'en'

        console.log('Lang:', lang)
        next()
    })

    app.use(express.json())

    app.use('/', general)
    app.use('/airports', airports)
    app.use('/routes', routes)
    app.listen(port, () => {
        console.log(`⚡️[server]: Server is running at http://localhost:${port}`);
    });
}

// module.exports = sequelize

export {
    app
}

