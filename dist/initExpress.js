"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = exports.getLang = void 0;
const express_1 = __importDefault(require("express"));
const general_1 = __importDefault(require("./routes/general"));
const airports_1 = __importDefault(require("./routes/airports"));
const routes_1 = __importDefault(require("./routes/routes"));
const swaggerUi = require('swagger-ui-express');
const swaggerJSON = require('./swagger_output.json');
const app = (0, express_1.default)();
exports.app = app;
const port = 3000;
let lang = 'ru';
function getLang() {
    return lang;
}
exports.getLang = getLang;
exports.default = () => {
    app.use('/doc', swaggerUi.serve, swaggerUi.setup(swaggerJSON));
    app.use((req, res, next) => {
        let date = new Date().toUTCString();
        let langHead = req.header('Accept-Language');
        console.log('---');
        console.log('Time:', date);
        if (langHead) {
            // :::^))) ternary hell fan here - less
            lang = langHead.includes(';') ?
                langHead.split(';')[0].split(',')[1] :
                langHead.includes('-') ? langHead.split('-')[0] :
                    langHead;
        }
        else
            lang = 'en';
        console.log('Lang:', lang);
        next();
    });
    app.use('/', general_1.default);
    app.use('/airports', airports_1.default);
    app.use('/routes', routes_1.default);
    app.listen(port, () => {
        console.log(`⚡️[server]: Server is running at http://localhost:${port}`);
    });
};
